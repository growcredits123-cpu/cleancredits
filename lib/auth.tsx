import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { User } from './types';

interface AuthContextValue {
  session: Session | null;
  profile: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const url = Linking.useURL();

  useEffect(() => {
    const rawUrl = url || (typeof window !== 'undefined' ? window.location.href : null);
    if (!rawUrl) return;
    
    const parseUrl = async () => {
      try {
        const hash = rawUrl.split('#')[1];
        if (!hash) return;
        
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) console.error('Deep link session error:', error.message);
        }
      } catch (e) {
        console.error('Failed to parse deep link URL', e);
      }
    };
    
    parseUrl();
  }, [url]);

  async function loadProfile(uid: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      if (error) {
        console.warn('loadProfile error:', error.message);
      }
      if (data) {
        setProfile(data as User);
      } else {
        setProfile({ id: uid, name: 'User', email: '', rating_avg: 0 } as User);
      }
    } catch (e) {
      console.warn('loadProfile exception:', e);
      setProfile({ id: uid, name: 'User', email: '', rating_avg: 0 } as User);
    }
  }

  async function ensureProfile(s: Session) {
    try {
      const uid = s.user.id;
      const name =
        (s.user.user_metadata?.full_name as string) ||
        (s.user.user_metadata?.name as string) ||
        (s.user.email ? s.user.email.split('@')[0] : 'User');
      const avatarUrl = (s.user.user_metadata?.avatar_url as string) || null;

      const { error } = await supabase.from('users').upsert(
        {
          id: uid,
          name,
          email: s.user.email || '',
          avatar_url: avatarUrl,
        },
        { onConflict: 'id' }
      );
      if (error) {
        console.warn('ensureProfile database error:', error.message);
      }
    } catch (e) {
      console.warn('ensureProfile exception:', e);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) console.warn('getSession error:', error.message);
        const currentSession = data?.session || null;
        setSession(currentSession);
        if (currentSession) {
          await ensureProfile(currentSession);
          if (mounted) await loadProfile(currentSession.user.id);
        }
      } catch (err) {
        console.warn('initAuth exception:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession) {
        ensureProfile(newSession).then(() => {
          if (mounted) loadProfile(newSession.user.id);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  async function signInWithEmail(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data?.session) {
        setSession(data.session);
        await ensureProfile(data.session);
        await loadProfile(data.session.user.id);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Authentication failed.' };
    }
  }

  async function signUpWithEmail(email: string, password: string, name: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { full_name: name },
          emailRedirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : Linking.createURL('/'),
        },
      });
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return { error: 'Email already exists.' };
        }
        return { error: error.message };
      }
      
      if (data?.user && data.user.identities && data.user.identities.length === 0) {
        return { error: 'Email already exists.' };
      }

      if (data?.user) {
        await supabase.from('users').upsert(
          {
            id: data.user.id,
            name,
            email,
          },
          { onConflict: 'id' }
        );
      }
      
      if (data?.session && data?.user) {
        setSession(data.session);
        await loadProfile(data.user.id);
        return { error: null };
      } else if (data?.user && !data?.session) {
        return { error: 'verification_required' };
      }
      
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Sign up failed.' };
    }
  }

  async function signInWithGoogle() {
    return { error: 'OAuth login disabled.' };
  }

  async function signInWithApple() {
    return { error: 'OAuth login disabled.' };
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('signOut exception:', e);
    } finally {
      setSession(null);
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id);
  }

  async function resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : Linking.createURL('/(auth)/reset-password'),
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Password reset failed.' };
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signInWithApple,
        signOut,
        refreshProfile,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
