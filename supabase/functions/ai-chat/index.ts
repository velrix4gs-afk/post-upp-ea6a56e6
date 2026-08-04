import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AISettings {
  provider: 'lovable' | 'openai' | 'anthropic' | 'google';
  model: string;
  custom_api_key: string;
  system_prompt_user: string;
  system_prompt_admin: string;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'lovable',
  model: 'google/gemini-2.5-flash',
  custom_api_key: '',
  system_prompt_user: 'You are Post Up AI - a friendly and helpful assistant for the Post Up social media platform. Help users navigate the app, answer questions about features, and provide tips for better engagement. Be conversational and friendly. Use emojis occasionally.',
  system_prompt_admin: 'You are Post Up Admin AI - an intelligent assistant for administrators. Summarize user feedback, identify patterns in complaints or suggestions, provide actionable insights, and help draft responses to user issues. Be concise, professional, and data-driven.'
};

/**
 * Full map of the POST UP app so the assistant can actually help users
 * navigate and get things done, instead of guessing.
 */
const APP_KNOWLEDGE = `
## POST UP — app knowledge

POST UP is a mobile-first social app (web + Android/iOS via Capacitor).

### Screens and routes
- /feed — main feed with two tabs: "For You" (discovery mix) and "Following" (only accounts the user follows). Stories sit on top; a fixed one-line post bar sits under them.
- /explore — search and discovery of people, posts and hashtags.
- /search — dedicated search page (people, posts, hashtags).
- /reels — vertical short videos. /create/reel to make one.
- /create/story — story editor: gallery picker, filters, crop, adjustments, text, stickers, drawing, audience selector. (Camera capture is intentionally not available.)
- /messages — chats: text, photos, videos, voice notes, reactions, replies, wallpapers, pinning, muting. Voice and video calls start from the chat header.
- /notifications is inside the bell panel — follows, likes, comments, mentions, friend and follow requests (requests can be accepted right in the panel).
- /profile/:userId — a user profile: posts, replies, likes, media tabs, follow / message buttons.
- /bookmarks — saved posts.
- /friends — friends and requests.
- /pages — creator/brand pages, /pages/create to make one.
- /premium, /coins, /purchase-history — premium verification, coins and tipping.
- /settings — appearance/theme, notifications, chat settings, AI settings, verification, account.
- /post/:postId — full post detail with the comment thread.
- /onboarding — username, display name, avatar and interests for new users.

### Key behaviours to explain when asked
- Long-press any name or avatar for a quick profile peek.
- Posts support multiple images (swipeable carousel) and can be edited, including their images.
- Voice notes: hold the mic in a chat; a waveform is generated for playback.
- Themes and dark/light mode live in Settings → Appearance.
- Back navigation returns to the previous screen and re-opens whatever popup was open there.

### Navigation actions
When taking the user somewhere is genuinely useful, append action links on their own line using EXACTLY this syntax:
[[go:/messages|Open messages]]
Rules: only use real routes from the list above, at most 3 per reply, and always keep a normal sentence explaining the step. Never invent routes or claim to have performed an action you cannot perform — you can only offer navigation links.
`;

async function getAISettings(): Promise<AISettings> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('ai_settings')
      .select('setting_key, setting_value');

    if (error || !data || data.length === 0) {
      console.log('Using default AI settings');
      return DEFAULT_SETTINGS;
    }

    const settings: Partial<AISettings> = {};
    data.forEach((row: { setting_key: string; setting_value: string }) => {
      try {
        settings[row.setting_key as keyof AISettings] = JSON.parse(row.setting_value);
      } catch {
        settings[row.setting_key as keyof AISettings] = row.setting_value as any;
      }
    });

    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return DEFAULT_SETTINGS;
  }
}

async function callLovableAI(messages: any[], model: string, systemPrompt: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }

  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });
}

async function callOpenAI(messages: any[], model: string, apiKey: string, systemPrompt: string) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });
}

async function callAnthropic(messages: any[], model: string, apiKey: string, systemPrompt: string) {
  // Convert messages format for Anthropic
  const anthropicMessages = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    }),
  });
}

async function callGoogleAI(messages: any[], model: string, apiKey: string, systemPrompt: string) {
  // Convert messages to Gemini format
  const contents = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        }
      }),
    }
  );

  return response;
}

/**
 * Validates JWT and checks if user has admin role
 * Returns { userId, isAdmin } or null if unauthorized
 */
async function validateAuthAndGetRole(authHeader: string | null): Promise<{ userId: string; isAdmin: boolean } | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  // Validate the JWT and get user claims
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims?.sub) {
    console.error('JWT validation failed:', claimsError);
    return null;
  }

  const userId = claimsData.claims.sub;

  // Check admin role from database using service role client
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: roleData } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  return {
    userId,
    isAdmin: roleData !== null
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    const authResult = await validateAuthAndGetRole(authHeader);
    
    if (!authResult) {
      console.log('Unauthorized access attempt to ai-chat');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in to use AI chat.' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId, isAdmin } = authResult;
    console.log(`AI chat request from user ${userId}, isAdmin: ${isAdmin}`);

    const { messages, testConnection } = await req.json();
    
    // Fetch admin-configured settings
    const settings = await getAISettings();
    
    // Use appropriate system prompt based on SERVER-VALIDATED admin status
    const basePrompt = isAdmin ? settings.system_prompt_admin : settings.system_prompt_user;
    // Always give the model the full app map + navigation-link protocol.
    const systemPrompt = `${basePrompt}\n\n${APP_KNOWLEDGE}`;

    // For connection test, just return success
    if (testConnection) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let response: Response;

    // Route to appropriate AI provider
    if (settings.provider === 'google' && settings.custom_api_key) {
      // Google Gemini direct API (non-streaming for simplicity)
      response = await callGoogleAI(messages, settings.model, settings.custom_api_key, systemPrompt);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google AI error:", response.status, errorText);
        throw new Error("Google AI service error");
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
      
      // Return as OpenAI-compatible format for consistency
      return new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content } }]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (settings.provider === 'openai' && settings.custom_api_key) {
      response = await callOpenAI(messages, settings.model, settings.custom_api_key, systemPrompt);
    } else if (settings.provider === 'anthropic' && settings.custom_api_key) {
      response = await callAnthropic(messages, settings.model, settings.custom_api_key, systemPrompt);
    } else {
      // Default to Lovable AI
      response = await callLovableAI(messages, settings.model, systemPrompt);
    }

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI provider error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
