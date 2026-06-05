import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    const supabaseAnonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'TIP_001: No authorization header',
        code: 'TIP_001',
        message: 'You must be logged in to send tips'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabaseAnonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'TIP_002: Invalid token',
        code: 'TIP_002',
        message: 'Invalid or expired authentication'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { recipient_id, amount, message } = body;

    console.log(`[TIP_001] Processing tip: sender=${user.id}, recipient=${recipient_id}, amount=${amount}`);

    // Validate recipient
    if (!recipient_id || typeof recipient_id !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'TIP_003: Invalid recipient',
        code: 'TIP_003',
        message: 'Valid recipient ID is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent self-tipping
    if (recipient_id === user.id) {
      return new Response(JSON.stringify({ 
        error: 'TIP_003: Self-tip not allowed',
        code: 'TIP_003',
        message: 'You cannot tip yourself'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate amount type and range
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return new Response(JSON.stringify({ 
        error: 'TIP_004: Invalid amount type',
        code: 'TIP_004',
        message: 'Amount must be a valid number'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (amount < 1 || amount > 10000) {
      return new Response(JSON.stringify({ 
        error: 'TIP_004: Invalid amount',
        code: 'TIP_004',
        message: 'Tip amount must be between $1 and $10,000'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate decimal precision (max 2 decimal places)
    if (!Number.isInteger(amount * 100)) {
      return new Response(JSON.stringify({ 
        error: 'TIP_004: Invalid precision',
        code: 'TIP_004',
        message: 'Amount can have at most 2 decimal places'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate message length if provided
    if (message && (typeof message !== 'string' || message.length > 500)) {
      return new Response(JSON.stringify({ 
        error: 'TIP_005: Invalid message',
        code: 'TIP_005',
        message: 'Message must be less than 500 characters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit (10 tips per minute)
    const { data: rateLimitResult, error: rateLimitError } = await supabaseClient
      .rpc('check_and_increment_rate_limit', {
        p_user_id: user.id,
        p_action: 'send_tip',
        p_max_attempts: 10,
        p_window_seconds: 60,
        p_block_duration_seconds: 300
      });

    if (rateLimitError) {
      console.error('[TIP_ERROR] Rate limit check failed:', rateLimitError);
    } else if (rateLimitResult && !rateLimitResult.allowed) {
      return new Response(JSON.stringify({ 
        error: 'TIP_006: Rate limit exceeded',
        code: 'TIP_006',
        message: 'Too many tips sent. Please wait before sending another tip.'
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if sender is verified
    const { data: senderProfile } = await supabaseClient
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single();

    if (!senderProfile?.is_verified) {
      return new Response(JSON.stringify({ 
        error: 'TIP_007: Verification required',
        code: 'TIP_007',
        message: 'You must be verified to send tips. Get verified to unlock this feature!'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // In a real implementation, you would:
    // 1. Process payment via Stripe
    // 2. Record transaction in database
    // 3. Send notification to recipient
    
    // For now, we'll just create a notification
    await supabaseClient.from('notifications').insert({
      user_id: recipient_id,
      type: 'tip',
      title: 'New Tip Received',
      content: message || `You received a $${amount} tip!`,
      data: { 
        sender_id: user.id, 
        amount: amount,
        message: message
      }
    });

    console.log(`[TIP_002] Tip processed successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Tip sent successfully',
      amount: amount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TIP_ERROR] Error processing tip:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process tip',
      code: 'TIP_999',
      message: 'Failed to process tip'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
