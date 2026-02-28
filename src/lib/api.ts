import { supabase } from './supabase'

// Uses env var — no hardcoded URLs
const GATEWAY = import.meta.env.VITE_GATEWAY_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  headers.set('apikey', ANON_KEY)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${GATEWAY}${endpoint}`, { ...options, headers })

  // Do NOT auto-signout on 401 — just surface the error to the UI
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired. Please log in again.')
    }
    throw new Error(errorData.error || errorData.message || `Request failed: ${response.status}`)
  }

  return response.json()
}

export const api = {
  getDashboard: () => request<any>('/dashboard'),
  getAudits: (pageSize = 20, offset = 0) =>
    request<any>(`/audits?page_size=${pageSize}&offset=${offset}`),
  getAudit: (id: string) => request<any>(`/audits/${id}`),
  getTickets: () => request<any>('/tickets'),
  createTicket: (data: { category: string; message: string; audit_record_id?: string }) =>
    request<any>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  getArtifacts: () => request<any>('/deliverables'),
  checkout: (auditId: string, tier: string) =>
    request<any>('/checkout', {
      method: 'POST',
      body: JSON.stringify({ audit_id: auditId, tier }),
    }),
  generateGamma: (auditId: string) =>
    request<any>('/gamma/generate', {
      method: 'POST',
      body: JSON.stringify({ audit_id: auditId }),
    }),
  generateJam: (auditId: string) =>
    request<any>('/jam/generate', {
      method: 'POST',
      body: JSON.stringify({ audit_id: auditId }),
    }),
  verifyCertificate: (hash: string) => request<any>(`/certificates/${hash}`),
  downloadCertificate: (auditId: string) => request<any>(`/certificates/${auditId}/download`),
}
