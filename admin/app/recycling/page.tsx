import { getAdminClient } from '@/lib/supabase';
import RecyclingReviewClient from './client';

export const dynamic = 'force-dynamic';

async function getPendingSpots() {
  const adminSupabase = getAdminClient();
  const { data } = await adminSupabase
    .from('recycling_spots')
    .select('id, user_id, lat, lng, photo_url, status, geohash, created_at, user:users!recycling_spots_user_id_fkey(name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return data || [];
}

async function getApprovedSpots() {
  const adminSupabase = getAdminClient();
  const { data } = await adminSupabase
    .from('recycling_spots')
    .select('id, lat, lng, geohash')
    .eq('status', 'approved');
  return data || [];
}

export default async function RecyclingPage() {
  const [pending, approved] = await Promise.all([getPendingSpots(), getApprovedSpots()]);

  // Flag duplicates: pending spots whose geohash prefix matches an approved spot
  const approvedPrefixes = new Set((approved as any[]).map((s) => s.geohash.slice(0, 8)));
  const pendingWithFlags = (pending as any[]).map((s) => ({
    ...s,
    duplicate: approvedPrefixes.has(s.geohash.slice(0, 8)),
  }));

  return <RecyclingReviewClient spots={pendingWithFlags} />;
}
