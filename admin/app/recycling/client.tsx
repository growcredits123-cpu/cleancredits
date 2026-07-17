'use client';

import { useState } from 'react';
import { getAdminClient } from '@/lib/supabase';
import { Check, X, MapPin, AlertTriangle, Clock } from 'lucide-react';

interface Spot {
  id: string;
  lat: number;
  lng: number;
  photo_url: string | null;
  geohash: string;
  created_at: string;
  duplicate: boolean;
  user: { name: string; email: string } | null;
}

export default function RecyclingReviewClient({ spots: initial }: { spots: Spot[] }) {
  const [spots, setSpots] = useState<Spot[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function approve(id: string) {
    setBusyId(id);
    const adminSupabase = getAdminClient();
    const { error } = await adminSupabase.rpc('approve_recycling_spot', { p_spot_id: id, p_reward: 5 });
    setBusyId(null);
    if (!error) setSpots((prev) => prev.filter((s) => s.id !== id));
  }

  async function reject(id: string) {
    setBusyId(id);
    const adminSupabase = getAdminClient();
    const { error } = await adminSupabase.rpc('reject_recycling_spot', { p_spot_id: id });
    setBusyId(null);
    if (!error) setSpots((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Recycling Spot Review</h1>
      <p className="text-gray-500 mb-8">Approve or reject user-reported recycling spots. Approval credits 5 ◆ to the reporter.</p>

      {spots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No pending spots to review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {spots.map((spot) => (
            <div key={spot.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {spot.photo_url && (
                <img src={spot.photo_url} alt="Recycling spot" className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-eco-600" />
                    {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                  </div>
                  {spot.duplicate && (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      Duplicate location
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mb-1">
                  Reported by <span className="font-medium text-gray-700">{spot.user?.name || 'Unknown'}</span>
                </div>
                <div className="text-xs text-gray-400 mb-4">
                  {new Date(spot.created_at).toLocaleString()} · geohash {spot.geohash.slice(0, 8)}…
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(spot.id)}
                    disabled={busyId === spot.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-eco-500 text-white font-semibold py-2 rounded-lg hover:bg-eco-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve (+5 ◆)
                  </button>
                  <button
                    onClick={() => reject(spot.id)}
                    disabled={busyId === spot.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 font-semibold py-2 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
