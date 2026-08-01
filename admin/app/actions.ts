'use server';

import { getAdminClient } from '@/lib/supabase';

export async function searchUsers(query: string) {
  if (!query.trim()) return [];
  const adminSupabase = getAdminClient();
  const { data } = await adminSupabase
    .from('users')
    .select('id, name, email, is_blocked')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);
  return data || [];
}

export async function issueTokens(userId: string, amount: number, note: string) {
  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.rpc('admin_issue_tokens', {
    p_user_id: userId,
    p_amount: amount,
    p_note: note || null,
  });
  if (error) return { ok: false, msg: error.message };
  return { ok: true };
}

export async function approveRecyclingSpot(spotId: string) {
  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.rpc('approve_recycling_spot', { p_spot_id: spotId, p_reward: 5 });
  return { error: error?.message || null };
}

export async function rejectRecyclingSpot(spotId: string) {
  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.rpc('reject_recycling_spot', { p_spot_id: spotId });
  return { error: error?.message || null };
}

export async function toggleBlockUser(userId: string, currentStatus: boolean) {
  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.from('users').update({ is_blocked: !currentStatus }).eq('id', userId);
  return { error: error?.message || null };
}

export async function removeListing(itemId: string) {
  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.from('items').update({ status: 'removed' }).eq('id', itemId);
  return { error: error?.message || null };
}

export async function resolveReport(reportId: string) {
  const adminSupabase = getAdminClient();
  const { error } = await adminSupabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
  return { error: error?.message || null };
}
