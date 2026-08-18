import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2022-11-15',
    httpClient: Stripe.createFetchHttpClient(),
  })

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  let event

  try {
    const body = await req.text()
    // 3. ASSINATURA DO WEBHOOK
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    )
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 3. CONTROLE DE IDEMPOTÊNCIA
  const { data: existingEvent } = await supabaseAdmin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .single()

  if (existingEvent) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Registrar evento para evitar processamento duplicado
  await supabaseAdmin.from('stripe_events').insert({
    id: event.id,
    type: event.type
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata.user_id
        const subscriptionId = session.subscription

        // Aqui você atualizaria a tabela subscriptions
        // (Exemplo: upsert na tabela subscriptions com status active)
        console.log(`Checkout completed for user ${userId}, subscription ${subscriptionId}`)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        // Lógica para cancelar acesso
        console.log(`Subscription deleted: ${subscription.id}`)
        break
      }
      // Adicionar outros eventos conforme necessário
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`Error processing webhook: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 500 })
  }
})
