import { getAdminClient } from '@/lib/supabase';
import { Users, ArrowDownUp, Coins, MapPin, Star, Flag, Settings } from 'lucide-react';
import { GlobalSettingsToggle } from './GlobalSettingsToggle';

export const dynamic = 'force-dynamic';

async function getStats() {
  const adminSupabase = getAdminClient();
  const [users, exchanges, ledger, recycling, ratings, reports, settings] = await Promise.all([
    adminSupabase.from('users').select('id', { count: 'exact', head: true }),
    adminSupabase.from('exchanges').select('id, status', { count: 'exact' }),
    adminSupabase.from('ledger_entries').select('entry_type, amount'),
    adminSupabase.from('recycling_spots').select('id, status', { count: 'exact' }),
    adminSupabase.from('ratings').select('id', { count: 'exact', head: true }),
    adminSupabase.from('reports').select('id, status', { count: 'exact' }),
    adminSupabase.from('app_events').select('payload').eq('event_type', 'global_settings').order('created_at', { ascending: false }).limit(1),
  ]);

  const totalUsers = users.count || 0;
  const activeExchanges = (exchanges.data || []).filter((e: any) =>
    ['requested', 'accepted', 'token_held', 'picked_up'].includes(e.status)
  ).length;
  const totalTokens = (ledger.data || []).reduce(
    (sum: number, e: any) => sum + (e.entry_type === 'credit' ? e.amount : -e.amount),
    0
  );
  const pendingRecycling = (recycling.data || []).filter((r: any) => r.status === 'pending').length;
  const openReports = (reports.data || []).filter((r: any) => r.status === 'open').length;
  
  const requireId = settings.data?.[0]?.payload?.require_id === true;

  return { totalUsers, activeExchanges, totalTokens, pendingRecycling, totalRatings: ratings.count || 0, openReports, requireId };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-500' },
    { label: 'Active Exchanges', value: stats.activeExchanges, icon: ArrowDownUp, color: 'bg-eco-500' },
    { label: 'Tokens in Circulation', value: stats.totalTokens, icon: Coins, color: 'bg-amber-500' },
    { label: 'Pending Recycling Spots', value: stats.pendingRecycling, icon: MapPin, color: 'bg-purple-500' },
    { label: 'Total Ratings', value: stats.totalRatings, icon: Star, color: 'bg-pink-500' },
    { label: 'Open Reports', value: stats.openReports, icon: Flag, color: 'bg-red-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
      <p className="text-gray-500 mb-8">Overview of the FruitMap marketplace</p>

      <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200">
        <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
          <Settings className="w-5 h-5" /> Global Settings
        </h2>
        <GlobalSettingsToggle initialRequireId={stats.requireId} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold mt-3">{card.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-bold text-lg mb-2">Double-Entry Ledger Check</h2>
        <p className="text-sm text-gray-500 mb-4">
          Every exchange should sum to zero net token movement. Run this query in the SQL editor to verify:
        </p>
        <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto">
{`SELECT exchange_id,
  SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END) AS net
FROM ledger_entries
WHERE exchange_id IS NOT NULL
GROUP BY exchange_id
HAVING SUM(CASE WHEN entry_type='credit' THEN amount ELSE -amount END) != 0;`}
        </pre>
        <p className="text-sm text-gray-500 mt-3">An empty result means all exchanges are balanced.</p>
      </div>
    </div>
  );
}
