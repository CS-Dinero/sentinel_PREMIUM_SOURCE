import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export const config = {
  api: { bodyParser: false }
}

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sig = req.headers['stripe-signature']
  const rawBody = await getRawBody(req)
  let event

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const clientId = session.client_reference_id

    if (!clientId) {
      console.error('No client_reference_id in session')
      return res.json({ received: true })
    }

    // Update prospect_leads is_paid flag
    const { error: leadError } = await supabase
      .from('prospect_leads')
      .update({ is_paid: true })
      .eq('user_id', clientId)

    if (leadError) {
      console.error('Failed to update prospect_leads:', leadError)
    }

    // Update audits is_paid flag
    const { data: leads } = await supabase
      .from('prospect_leads')
      .select('id')
      .eq('user_id', clientId)

    if (leads && leads.length > 0) {
      const prospectIds = leads.map(l => l.id)
      const { error: auditError } = await supabase
        .from('audits')
        .update({ is_paid: true })
        .in('prospect_id', prospectIds)

      if (auditError) {
        console.error('Failed to update audits:', auditError)
      } else {
        console.log(`Payment confirmed for user ${clientId} — audits unlocked`)
      }
    }
  }

  res.json({ received: true })
}
