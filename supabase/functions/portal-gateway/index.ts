// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestContext {
  supabase: any
  userId: string
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getUserFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const supabase = getSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user.id
}

function invertScore(riskScore: number): number {
  return 100 - riskScore
}

function getStatusFromRiskScore(riskScore: number): string {
  if (riskScore >= 70) return 'LOCKED'
  if (riskScore >= 40) return 'PROCESSING'
  return 'READY'
}

// ─── GET /dashboard ──────────────────────────────────────────────
async function handleDashboard(ctx: RequestContext) {
  const { supabase, userId } = ctx

  const { data: prospects, error: pe } = await supabase
    .from('prospect_leads').select('id, company_name').eq('user_id', userId)
  if (pe) throw pe
  if (!prospects || prospects.length === 0) {
    return { overall_status: 'READY', health_score: 100, audit_count: 0, ticket_count: 0, artifact_count: 0, latest_audit: null, locks: [] }
  }

  const prospectIds = prospects.map((p: any) => p.id)

  const { data: audits, error: ae } = await supabase
    .from('audits').select('*').in('prospect_id', prospectIds)
    .order('created_at', { ascending: false })
  if (ae) throw ae

  const latestAudit = audits && audits.length > 0 ? audits[0] : null
  if (!latestAudit) {
    return { overall_status: 'READY', health_score: 100, audit_count: 0, ticket_count: 0, artifact_count: 0, latest_audit: null, locks: [] }
  }

  // Critical findings → locks
  const { data: critFindings } = await supabase
    .from('findings').select('*').eq('audit_id', latestAudit.id).eq('severity', 'CRITICAL').limit(6)

  const locks = (critFindings || []).map((f: any, i: number) => ({
    id: String(i + 1), name: f.title, status: 'LOCKED', description: f.description
  }))

  // Deliverables count
  const { count: delivCount } = await supabase
    .from('deliverables').select('*', { count: 'exact', head: true }).in('prospect_id', prospectIds)

  const prospect = prospects.find((p: any) => p.id === latestAudit.prospect_id)
  const riskScore = latestAudit.risk_score || 0

  return {
    overall_status: getStatusFromRiskScore(riskScore),
    health_score: invertScore(riskScore),
    audit_count: audits?.length || 0,
    ticket_count: 0,
    artifact_count: delivCount || 0,
    latest_audit: {
      id: latestAudit.id,
      score: invertScore(riskScore),
      status: getStatusFromRiskScore(riskScore),
      conducted_at: new Date(latestAudit.created_at).toISOString().split('T')[0],
      summary: latestAudit.diagnostic_report?.substring(0, 200) || 'Critical compliance failures detected across multiple regulatory frameworks.',
      entity_name: prospect?.company_name || 'Unknown'
    },
    locks
  }
}

// ─── GET /audits ─────────────────────────────────────────────────
async function handleAuditsList(ctx: RequestContext, url: URL) {
  const { supabase, userId } = ctx
  const pageSize = parseInt(url.searchParams.get('page_size') || '20')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const { data: prospects } = await supabase
    .from('prospect_leads').select('id, company_name').eq('user_id', userId)
  if (!prospects || prospects.length === 0) return { items: [], total: 0 }

  const prospectIds = prospects.map((p: any) => p.id)

  const { data: audits, error, count } = await supabase
    .from('audits').select('*', { count: 'exact' })
    .in('prospect_id', prospectIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  if (error) throw error

  const auditIds = audits?.map((a: any) => a.id) || []
  const { data: fc } = await supabase.from('findings').select('audit_id').in('audit_id', auditIds)
  const fcMap = new Map()
  fc?.forEach((f: any) => fcMap.set(f.audit_id, (fcMap.get(f.audit_id) || 0) + 1))

  const items = audits?.map((a: any) => {
    const prospect = prospects.find((p: any) => p.id === a.prospect_id)
    return {
      id: a.id,
      conducted_at: new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      score: invertScore(a.risk_score || 0),
      status: getStatusFromRiskScore(a.risk_score || 0),
      company_name: prospect?.company_name || 'Unknown',
      risk_level: a.risk_level || 'UNKNOWN',
      total_findings: fcMap.get(a.id) || 0
    }
  }) || []

  return { items, total: count || 0 }
}

// ─── GET /audits/:id ─────────────────────────────────────────────
async function handleAuditDetail(ctx: RequestContext, auditId: string) {
  const { supabase, userId } = ctx

  const { data: audit, error: ae } = await supabase
    .from('audits').select('*, prospect_leads!inner(company_name, user_id)')
    .eq('id', auditId).single()
  if (ae) throw ae
  if (audit.prospect_leads.user_id !== userId) throw new Error('Unauthorized')

  const { data: findings, error: fe } = await supabase
    .from('findings').select('*').eq('audit_id', auditId)
    .order('severity', { ascending: false })
  if (fe) throw fe

  const isPaid = audit.is_paid || false
  const gatedFindings = findings?.map((f: any) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    status: f.status || 'OPEN',
    category: f.framework,
    description: f.description,
    regulatory_citation: f.regulatory_citation,
    remediation_plan: isPaid ? (f.recommendation || 'No remediation plan available') : '[LOCKED — Upgrade to unlock full remediation plan]',
    code_preview: isPaid ? (f.code_preview || 'No code preview available') : '[LOCKED — Upgrade to unlock code fixes]'
  })) || []

  const remediationSteps = findings?.slice(0, 5).map((f: any) => ({
    step: f.title, status: 'PENDING'
  })) || []

  const riskScore = audit.risk_score || 0
  return {
    id: audit.id,
    conducted_at: new Date(audit.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    score: invertScore(riskScore),
    status: getStatusFromRiskScore(riskScore),
    entity_name: audit.prospect_leads.company_name,
    summary: audit.diagnostic_report?.substring(0, 200) || 'Critical compliance failures detected across multiple regulatory frameworks.',
    is_paid: isPaid,
    tier: audit.tier_suggestion || 'REMEDIATION_SPRINT',
    tier_price: audit.tier_suggestion === 'STANDARD_AUDIT' ? 197 : audit.tier_suggestion === 'FIX_PACK' ? 497 : 2500,
    findings: gatedFindings,
    remediation_steps: remediationSteps,
    has_certificate: !!audit.certificate_id,
    certificate_hash: audit.certificate_id || null,
    payment_url: null
  }
}

// ─── GET /deliverables ───────────────────────────────────────────
async function handleDeliverables(ctx: RequestContext) {
  const { supabase, userId } = ctx
  const { data: prospects } = await supabase
    .from('prospect_leads').select('id').eq('user_id', userId)
  if (!prospects || prospects.length === 0) return { items: [] }

  const { data: deliverables, error } = await supabase
    .from('deliverables').select('*')
    .in('prospect_id', prospects.map((p: any) => p.id))
    .order('created_at', { ascending: false })
  if (error) throw error

  const items = deliverables?.map((d: any) => ({
    id: d.id, name: d.name, type: d.type, description: d.description,
    status: d.status, tier_required: d.tier_required,
    created_at: new Date(d.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase().replace(/ /g, '_'),
    public_url: d.status === 'READY' ? d.external_url : null
  })) || []

  return { items }
}

// ─── GET /tickets (stub) ─────────────────────────────────────────
async function handleTicketsList(_ctx: RequestContext) {
  return { items: [] }
}

// ─── POST /tickets (stub) ────────────────────────────────────────
async function handleCreateTicket(_ctx: RequestContext, _body: any) {
  return { message: 'Ticket system coming in Phase 2' }
}

// ─── POST /checkout (stub) ───────────────────────────────────────
async function handleCheckout(_ctx: RequestContext, _body: any) {
  return { message: 'Stripe checkout coming in Phase 2' }
}

// ─── GET /certificates/:hash (PUBLIC) ────────────────────────────
async function handleCertificateVerify(supabase: any, hash: string) {
  const { data: cert, error } = await supabase
    .from('remediation_certs').select('*').eq('certificate_hash', hash).single()
  if (error || !cert) return { valid: false }
  return {
    valid: true, company_name: cert.company_name, issued_at: cert.created_at,
    engine_version: '3.0', findings_resolved: cert.findings_at_certification?.length || 0,
    certificate_hash: cert.certificate_hash, status: cert.status || 'ACTIVE'
  }
}

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const method = req.method

    // FIX: Strip function name prefix from path
    // Supabase sends /portal-gateway/dashboard → we need /dashboard
    const rawPath = url.pathname
    const path = rawPath.replace(/^\/portal-gateway/, '') || '/'

    const supabase = getSupabaseClient()

    // Public routes
    if (path.startsWith('/certificates/') && method === 'GET') {
      const hash = path.split('/')[2]
      const result = await handleCertificateVerify(supabase, hash)
      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Authenticated routes
    const userId = await getUserFromRequest(req)
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ctx: RequestContext = { supabase, userId }
    let result: any

    if (path === '/dashboard' && method === 'GET') {
      result = await handleDashboard(ctx)
    } else if (path === '/audits' && method === 'GET') {
      result = await handleAuditsList(ctx, url)
    } else if (path.match(/^\/audits\/[^/]+$/) && method === 'GET') {
      result = await handleAuditDetail(ctx, path.split('/')[2])
    } else if (path === '/deliverables' && method === 'GET') {
      result = await handleDeliverables(ctx)
    } else if (path === '/tickets' && method === 'GET') {
      result = await handleTicketsList(ctx)
    } else if (path === '/tickets' && method === 'POST') {
      result = await handleCreateTicket(ctx, await req.json())
    } else if (path === '/checkout' && method === 'POST') {
      result = await handleCheckout(ctx, await req.json())
    } else {
      return new Response(JSON.stringify({ error: 'Not found', path }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Portal Gateway Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
