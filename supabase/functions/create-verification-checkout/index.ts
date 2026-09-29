import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const ALLOWED_ORIGINS = [
  'https://post-upp.vercel.app',
  'https://post-upp.lovable.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

const getCorsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin || '') ? origin! : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
      apiVersion: '2023-10-16',
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // Server-side verification check to prevent bypassing payment
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single();

    if (profile?.is_verified) {
      return new Response(
        JSON.stringify({ error: 'Account already verified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId } = await req.json()

    // Create or get verification product and price
    const products = await stripe.products.list({
      active: true,
      limit: 100,
    })

    let product = products.data.find((p: Stripe.Product) => p.metadata?.type === 'verification')
    
    if (!product) {
      product = await stripe.products.create({
        name: 'Account Verification',
        description: 'Get verified with an official blue checkmark badge',
        metadata: { type: 'verification' },
      })
    }

    // Get or create price
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 1,
    })

    let price = prices.data[0]

    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 999, // $9.99
        currency: 'usd',
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.get('origin')}/profile?verification=success`,
      cancel_url: `${req.headers.get('origin')}/verification?canceled=true`,
      metadata: {
        userId: user.id,
        type: 'verification',
      },
      client_reference_id: user.id,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
