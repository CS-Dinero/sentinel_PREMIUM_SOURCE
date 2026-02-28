-- 001_schema_updates.sql
-- prospect_leads: add user_id for auth binding
ALTER TABLE prospect_leads
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- audits: add gating fields
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS certificate_id UUID;

-- portal_reports: add health_score (inverted risk for gauge)
ALTER TABLE portal_reports
  ADD COLUMN IF NOT EXISTS health_score INTEGER,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS locks JSONB DEFAULT '[]'::jsonb;

-- remediation_certs: ensure full schema
ALTER TABLE remediation_certs
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';


-- 002_deliverables_table.sql
CREATE TABLE IF NOT EXISTS deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID REFERENCES audits(id),
  prospect_id UUID REFERENCES prospect_leads(id),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'LOCKED',
  tier_required TEXT NOT NULL,
  content_text TEXT,
  content_json JSONB,
  storage_path TEXT,
  external_url TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 003_stripe_products.sql
CREATE TABLE IF NOT EXISTS stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL,
  tier_label TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  features JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO stripe_products (tier, tier_label, price_cents, features) VALUES
  ('STANDARD_AUDIT', 'Standard Audit', 19700, '["18-Point Compliance Scan", "Risk Score Report", "Findings Summary"]'),
  ('FIX_PACK', 'Technical Fix Pack', 49700, '["Everything in Standard", "Code Fix Package", "Jam.com Video Walkthrough", "Implementation Guide"]'),
  ('REMEDIATION_SPRINT', 'Remediation Sprint', 250000, '["Everything in Fix Pack", "Full Remediation Execution", "Gamma Presentation Deck", "SOW + Contract", "SHA-256 Verified Certificate", "48-Hour Priority SLA"]')
ON CONFLICT (tier) DO NOTHING;


-- 004_rls_policies.sql
-- Enable RLS on all client-facing tables
ALTER TABLE prospect_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_certs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_ledger ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "clients_own_data" ON prospect_leads;
DROP POLICY IF EXISTS "clients_own_audits" ON audits;
DROP POLICY IF EXISTS "clients_own_findings" ON findings;

-- Clients see only their own data
CREATE POLICY "clients_own_data" ON prospect_leads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "clients_own_audits" ON audits
  FOR SELECT USING (
    prospect_id IN (SELECT id FROM prospect_leads WHERE user_id = auth.uid())
  );

CREATE POLICY "clients_own_findings" ON findings
  FOR SELECT USING (
    audit_id IN (
      SELECT a.id FROM audits a
      JOIN prospect_leads p ON a.prospect_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );


-- 005_admin_users.sql
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
