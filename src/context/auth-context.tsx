'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; requiresConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseBrowserClient();

  const fetchOrCreateProfile = useCallback(async (currentUser: User) => {
    try {
      // 1. Try to fetch existing profile
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
        return;
      }

      // 2. If profile doesn't exist yet, create it safely
      const fullName = (currentUser.user_metadata?.full_name as string) || '';
      const email = currentUser.email || '';

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: currentUser.id,
            full_name: fullName,
            email: email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (insertError) {
        console.error('Failed to create/fetch profile:', insertError.message);
      } else if (newProfile) {
        setProfile(newProfile);
      }
    } catch (err: unknown) {
      console.error('Profile fetch unexpected error:', err);
    }
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchOrCreateProfile(user);
    }
  }, [user, fetchOrCreateProfile]);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        setIsLoading(true);
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('Initial session check failed:', sessionError.message);
        }

        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            await fetchOrCreateProfile(initialSession.user);
          } else {
            setProfile(null);
          }
        }
      } catch (err: unknown) {
        console.error('Failed to initialize auth state:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Supabase holds its session lock while delivering this callback.
        // Fetch the profile after the callback returns to avoid re-entering it.
        setTimeout(() => {
          if (isMounted) void fetchOrCreateProfile(newSession.user);
        }, 0);
      } else {
        setProfile(null);
      }

      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchOrCreateProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const friendlyMsg = formatAuthError(signInError.message);
        setError(friendlyMsg);
        return { error: friendlyMsg };
      }

      if (data.user) {
        const access = await fetch('/api/auth/access');
        if (!access.ok) {
          await supabase.auth.signOut();
          const message = 'This account is not enabled for this business. Contact the owner for access.';
          setError(message);
          return { error: message };
        }
        setUser(data.user);
        setSession(data.session);
        await fetchOrCreateProfile(data.user);
      }

      return { error: null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during sign in';
      setError(msg);
      return { error: msg };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null; requiresConfirmation?: boolean }> => {
    setError(null);
    try {
      // 1. Register user via server-side endpoint to ensure auto-confirmation and prevent SMTP throttling
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = json.error || 'Failed to create account';
        setError(errorMsg);
        return { error: errorMsg };
      }

      if (json.requiresEmailConfirmation) {
        return { error: null, requiresConfirmation: true };
      }

      // 2. Automatically sign in when confirmation is not required.
      const signInResult = await signIn(email, password);
      if (signInResult.error) {
        return { error: signInResult.error };
      }

      return { error: null };
    } catch {
      // Fallback to client signUp if endpoint fails
      try {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (signUpError) {
          const friendly = formatAuthError(signUpError.message);
          setError(friendly);
          return { error: friendly };
        }
        if (data.user && !data.session) {
          return { error: null, requiresConfirmation: true };
        }
        if (data.user && data.session) {
          setUser(data.user);
          setSession(data.session);
          await fetchOrCreateProfile(data.user);
        }
        return { error: null };
      } catch (fallbackErr: unknown) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : 'Registration failed';
        setError(msg);
        return { error: msg };
      }
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setError(null);
    } catch (err: unknown) {
      console.error('Sign out failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        error,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function formatAuthError(msg: string): string {
  if (msg.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid email or password. Please verify and try again.';
  }
  if (msg.toLowerCase().includes('user already registered')) {
    return 'An account with this email address already exists. Please log in.';
  }
  if (msg.toLowerCase().includes('password should be at least')) {
    return 'Password is too weak. Please provide at least 6 characters.';
  }
  if (msg.toLowerCase().includes('rate limit')) {
    return 'Too many login attempts. Please wait a few minutes before trying again.';
  }
  return msg;
}
