import { getAdminClient } from '@/lib/supabase';
import ModerationClient from './client';

export const dynamic = 'force-dynamic';

async function getData() {
  const adminSupabase = getAdminClient();
  const [users, items, reports] = await Promise.all([
    adminSupabase.from('users').select('id, name, email, is_blocked, rating_avg, created_at').order('created_at', { ascending: false }),
    adminSupabase.from('items').select('id, owner_id, title, status, created_at, owner:users!items_owner_id_fkey(name)').order('created_at', { ascending: false }),
    adminSupabase.from('reports').select('id, reporter_id, reported_user_id, reason, status, created_at, reporter:users!reports_reporter_id_fkey(name), reported:users!reports_reported_user_id_fkey(name, email)').order('created_at', { ascending: false }),
  ]);
  return {
    users: users.data || [],
    items: items.data || [],
    reports: reports.data || [],
  };
}

export default async function ModerationPage() {
  const data = await getData();
  return <ModerationClient {...data} />;
}
