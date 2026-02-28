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
