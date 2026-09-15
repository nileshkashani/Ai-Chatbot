"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    getSupabase().auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign up with email and password
  const signUp = async (email, password) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    const { data, error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Sign out
  const signOut = async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  };

  // Get the current access token for API calls
  const getAccessToken = () => {
    return session?.access_token ?? null;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
