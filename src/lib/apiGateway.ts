// Modular API gateway client. All client-side mutations route through here
// to the Supabase Edge Functions (our serverless backend wrapper).
//
// SECURITY: Never embeds Redis/host/port/password. Reads `VITE_API_GATEWAY_URL`
// when explicitly provided; otherwise derives the Supabase Functions URL from
// `VITE_SUPABASE_URL`. Sensitive credentials (REDIS_URL, REDIS_TOKEN, etc.)
// live ONLY in edge-function env vars and are never shipped to the browser.

import { supabase } from '@/integrations/supabase/client';

const GATEWAY_URL: string = (() => {
  const explicit = import.meta.env.VITE_API_GATEWAY_URL as string | undefined;
  if (explicit && explicit.length > 0) return explicit.replace(/\/$/, '');
  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supaUrl) return `${supaUrl.replace(/\/$/, '')}/functions/v1`;
  return '';
})();

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface GatewayResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * Invoke an edge function by name. Uses supabase.functions.invoke under the
 * hood so we reuse session auth + project-level URL resolution.
 */
export async function invokeFunction<T = unknown>(
  name: string,
  body?: unknown,
): Promise<GatewayResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      return { ok: false, status: 0, data: null, error: error.message };
    }
    return { ok: true, status: 200, data: data as T };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

/**
 * Low-level HTTP POST to the API gateway (used when invoke is not desired,
 * e.g. cross-origin custom paths). Always attaches the current JWT.
 */
export async function post<T = unknown>(path: string, body: unknown): Promise<GatewayResponse<T>> {
  if (!GATEWAY_URL) {
    return { ok: false, status: 0, data: null, error: 'API gateway URL not configured' };
  }
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...(await authHeader()),
    };
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

export async function get<T = unknown>(path: string): Promise<GatewayResponse<T>> {
  if (!GATEWAY_URL) {
    return { ok: false, status: 0, data: null, error: 'API gateway URL not configured' };
  }
  try {
    const res = await fetch(`${GATEWAY_URL}${path}`, {
      method: 'GET',
      headers: await authHeader(),
    });
    const json = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

export const apiGateway = { invokeFunction, post, get };
