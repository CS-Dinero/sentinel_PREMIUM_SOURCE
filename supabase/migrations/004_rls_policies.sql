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
