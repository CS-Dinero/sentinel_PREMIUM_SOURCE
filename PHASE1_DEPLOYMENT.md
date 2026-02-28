# Phase 1 Deployment Guide
## Sentinel Compliance Portal - Supabase Gateway Integration

This guide explains how to deploy Phase 1 of the Sentinel Compliance Portal integration with Supabase Edge Functions.

---

## Overview

Phase 1 implements:
1. **Database Schema Updates**: New columns and tables for payment gating and deliverables
2. **Supabase Edge Function**: REST API gateway with JWT authentication
3. **Frontend Updates**: Direct Supabase auth (no external gateway)
4. **Score Inversion Logic**: Database risk_score → Frontend health_score
5. **Findings Gating**: Premium content locked until payment

---

## Prerequisites

- **Supabase Project**: `https://lydqndwveizryjoyzugt.supabase.co`
- **Supabase CLI**: Install with `npm install -g supabase`
- **Node.js**: v18+ for frontend development
- **Access**: Supabase project admin access

---

## Step 1: Apply Database Migrations

### Option A: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/lydqndwveizryjoyzugt/sql/new
2. Copy the content from `supabase/combined_migrations.sql`
3. Paste into SQL Editor
4. Click "Run" to execute all migrations

### Option B: Via Supabase CLI

```bash
cd /home/ubuntu/sentinel_portal
supabase link --project-ref lydqndwveizryjoyzugt
supabase db push
```

### Verify Migrations

After running migrations, verify the following tables exist:
- `deliverables` (new)
- `stripe_products` (new)
- `admin_users` (new)

And these columns were added:
- `prospect_leads`: `user_id`, `email`, `payment_status`, `stripe_customer_id`
- `audits`: `is_paid`, `paid_at`, `stripe_payment_id`, `certificate_id`
- `portal_reports`: `health_score`, `summary`, `locks`

---

## Step 2: Deploy Edge Function

### Set Environment Variables

In Supabase Dashboard → Edge Functions → Secrets, add:

```
SUPABASE_URL=https://lydqndwveizryjoyzugt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_W8XcRRT8EJo9cUvNOc_1ag_MPcjq2_I
```

### Deploy the Function

```bash
cd /home/ubuntu/sentinel_portal
supabase functions deploy portal-gateway
```

Or via Supabase CLI:

```bash
npx supabase functions deploy portal-gateway --project-ref lydqndwveizryjoyzugt
```

### Verify Deployment

Test the Edge Function:

```bash
curl https://lydqndwveizryjoyzugt.supabase.co/functions/v1/portal-gateway/dashboard \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT"
```

---

## Step 3: Configure Frontend

### Environment Variables

The `.env.local` file has been updated with:

```env
VITE_SUPABASE_URL=https://lydqndwveizryjoyzugt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_BxYhbHQRiw9rRXTYX_UGMQ_gky6XI0r
```

### Install Dependencies

```bash
cd /home/ubuntu/sentinel_portal
npm install
```

### Run Development Server

```bash
npm run dev
```

The portal will be available at `http://localhost:5173`

---

## Step 4: Create Test User Account

### Via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/lydqndwveizryjoyzugt/auth/users
2. Click "Add User"
3. Enter email: `test@example.com`
4. Set password or use magic link
5. Click "Create User"

### Link User to Prospect

After creating the user, link it to a prospect in the database:

```sql
-- Get the user ID from auth.users
SELECT id FROM auth.users WHERE email = 'test@example.com';

-- Update prospect_leads with this user_id
UPDATE prospect_leads 
SET user_id = '<user_id_from_above>', 
    email = 'test@example.com'
WHERE company_name = 'Sage & Vine';
```

---

## Step 5: Test the Integration

### Test 1: Login Flow

1. Navigate to `http://localhost:5173/login`
2. Enter email: `test@example.com`
3. Check email for magic link (or use password if configured)
4. Click magic link to authenticate
5. Should redirect to `/dashboard`

### Test 2: Dashboard Display

After login, verify:
- ✅ Dashboard shows aggregate stats
- ✅ Health score gauge displays (inverted from risk_score)
- ✅ Overall status shows "LOCKED", "PROCESSING", or "READY"
- ✅ Latest audit summary displays
- ✅ Compliance locks grid shows critical findings

### Test 3: Audits List

Navigate to `/audits`:
- ✅ Audits list shows all audits for the user
- ✅ Each audit shows: company name, date, score, status
- ✅ Pagination works (if > 20 audits)

### Test 4: Audit Detail with Gating

Click on an audit:
- ✅ Audit detail page loads
- ✅ Findings table displays
- ✅ If `is_paid = false`: remediation_plan shows "[LOCKED — Upgrade to unlock...]"
- ✅ If `is_paid = false`: code_preview shows "[LOCKED — Upgrade to unlock...]"
- ✅ Regulatory citations and descriptions are visible (not gated)

---

## Edge Function Endpoints

### GET /dashboard
Returns aggregate stats for authenticated user.

**Response:**
```json
{
  "overall_status": "LOCKED",
  "health_score": 32,
  "audit_count": 2,
  "ticket_count": 0,
  "artifact_count": 0,
  "latest_audit": {
    "id": "uuid",
    "score": 32,
    "status": "LOCKED",
    "conducted_at": "2026-02-20",
    "summary": "Critical compliance failures...",
    "entity_name": "Dermlounge"
  },
  "locks": [...]
}
```

### GET /audits
Returns paginated list of audits.

**Query params:**
- `page_size` (default: 20)
- `offset` (default: 0)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "conducted_at": "Feb 20, 2026",
      "score": 0,
      "status": "LOCKED",
      "company_name": "Dermlounge",
      "risk_level": "CRITICAL",
      "total_findings": 18
    }
  ],
  "total": 2
}
```

### GET /audits/:id
Returns audit detail with gated findings.

**Response:**
```json
{
  "id": "uuid",
  "conducted_at": "Feb 20, 2026 23:43:25",
  "score": 0,
  "status": "LOCKED",
  "entity_name": "Dermlounge",
  "is_paid": false,
  "tier": "REMEDIATION_SPRINT",
  "tier_price": 2500,
  "findings": [
    {
      "id": "uuid",
      "title": "SMS opt-in language",
      "severity": "CRITICAL",
      "remediation_plan": "[LOCKED — Upgrade to unlock full remediation plan]",
      "code_preview": "[LOCKED — Upgrade to unlock code fixes]"
    }
  ],
  "remediation_steps": [...],
  "has_certificate": false
}
```

### POST /checkout
Stub endpoint for Phase 2.

**Response:**
```json
{
  "message": "coming soon",
  "note": "Stripe checkout integration will be implemented in Phase 2"
}
```

---

## Score Inversion Logic

**Critical Concept:**
- **Database**: `risk_score` (0-100, higher = worse compliance)
- **Frontend**: `health_score` (0-100, higher = better compliance)
- **Formula**: `health_score = 100 - risk_score`

**Example:**
- Dermlounge: `risk_score = 100` → `health_score = 0` (red gauge, LOCKED)
- Sage & Vine: `risk_score = 68` → `health_score = 32` (red gauge, LOCKED)

**Status Mapping:**
- `risk_score >= 70` → `"LOCKED"`
- `risk_score 40-69` → `"PROCESSING"`
- `risk_score < 40` → `"READY"`

---

## Gating Logic

Findings are gated based on `audits.is_paid`:

```typescript
if (!audit.is_paid) {
  finding.remediation_plan = "[LOCKED — Upgrade to unlock...]"
  finding.code_preview = "[LOCKED — Upgrade to unlock...]"
}
```

**Always visible** (not gated):
- Title
- Severity
- Description
- Regulatory citation
- Category/framework

**Gated** (requires payment):
- Remediation plan
- Code preview/fixes
- Full diagnostic report

---

## Troubleshooting

### Issue: "Unauthorized" error on all API calls

**Solution:**
1. Verify Edge Function is deployed: `supabase functions list`
2. Check environment variables in Supabase Dashboard
3. Verify JWT token is valid: Check browser console for auth errors
4. Ensure user is linked to a prospect via `user_id`

### Issue: Dashboard shows no data

**Solution:**
1. Check if user has `user_id` set in `prospect_leads`
2. Verify audits exist for that prospect
3. Check RLS policies are correctly applied
4. Test Edge Function directly with curl

### Issue: Migrations fail with "column already exists"

**Solution:**
The migrations use `IF NOT EXISTS` - safe to re-run. If issues persist:
1. Check which migrations completed: `SELECT * FROM supabase_migrations;`
2. Run remaining migrations individually

### Issue: Edge Function returns 500 error

**Solution:**
1. Check Edge Function logs: `supabase functions logs portal-gateway`
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
3. Check database connection and table existence

---

## Next Steps (Phase 2)

Phase 2 will implement:
- Stripe checkout integration
- Payment webhook handling
- Deliverables generation (Gamma, Jam.com)
- Certificate PDF generation
- Billing dashboard
- Admin portal

---

## Support

For issues or questions:
1. Check Edge Function logs: `supabase functions logs portal-gateway`
2. Check browser console for frontend errors
3. Verify database state in Supabase SQL Editor
4. Review specification: `/home/ubuntu/Uploads/user_message_2026-02-21_11-01-32.txt`

---

**Deployment Date**: 2026-02-21  
**Version**: Phase 1 - MVP Gateway Integration  
**Branch**: `feature/supabase-gateway`
