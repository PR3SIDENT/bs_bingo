import { supabase } from './supabase-client.js';

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}

export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/create`,
    },
  });
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) console.error('Anonymous sign-in error:', error.message);
  return data?.session || null;
}

export async function ensureSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;
  return signInAnonymously();
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .single();
  return data;
}
