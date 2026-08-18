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

  // 2. IDEMPOTÊNCIA NA ORDEM CERTA (verificar sem travar antes do sucesso)
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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata.user_id
        const subscriptionId = session.subscription

        if (!userId || !subscriptionId) {
          throw new Error('Missing metadata or subscription id')
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string)
        const stripeCustomerId = session.customer as string
        const planId = session.metadata.plan_id // Presumindo que passamos no checkout

        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: subscriptionId as string,
            plan_id: planId,
            status: subscription.status,
            period_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
          }, { onConflict: 'user_id' })

        if (error) throw error
        console.log(`Checkout success for user ${userId}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            period_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) throw error
        console.log(`Subscription updated: ${subscription.id}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'canceled',
          })
          .eq('stripe_subscription_id', subscription.id)

        if (error) throw error
        console.log(`Subscription canceled: ${subscription.id}`)
        break
      }
    }

    // 2. IDEMPOTÊNCIA: Grava o evento somente APÓS o processamento bem-sucedido
    await supabaseAdmin.from('stripe_events').insert({
      id: event.id,
      type: event.type
    })

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(`Error processing webhook: ${err.message}`)
    // Retorna 500 para o Stripe reenviar se falhar
    return new Response(`Webhook Error: ${err.message}`, { status: 500 })
  }
})
