import { createClient } from "@supabase/supabase-js";

function getNormalizedUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  // Strip trailing slashes and any accidental paths like /rest/v1 or /auth/v1
  return rawUrl.trim().replace(/\/(rest|auth)\/v1\/?$/, "").replace(/\/+$/, "");
}

function getAnonKey() {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
}

// Lazy-initialized client-side Supabase client (used in React components)
let _supabase = null;

export function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = getNormalizedUrl();
    const supabaseAnonKey = getAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
      );
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

// Proxy export so `import { supabase } from '@/lib/supabase'` continues to work cleanly
export const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabase();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Server-side Supabase client that uses the user's auth token for RLS
// Pass the Authorization header from the incoming request
export function createServerSupabase(authToken) {
  const supabaseUrl = getNormalizedUrl();
  const supabaseAnonKey = getAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });
}