require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase = createClient(url, key);

async function getStats() {
  const [users, exchanges, ledger, recycling, ratings, reports] = await Promise.all([
    adminSupabase.from('users').select('id', { count: 'exact', head: true }),
    adminSupabase.from('exchanges').select('id, status', { count: 'exact' }),
    adminSupabase.from('ledger_entries').select('entry_type, amount'),
    adminSupabase.from('recycling_spots').select('id, status', { count: 'exact' }),
    adminSupabase.from('ratings').select('id', { count: 'exact', head: true }),
    adminSupabase.from('reports').select('id, status', { count: 'exact' }),
  ]);

  console.log('users:', users);
  console.log('exchanges:', exchanges);

  const totalUsers = users.count || 0;
  const activeExchanges = (exchanges.data || []).filter((e) =>
    ['requested', 'accepted', 'token_held', 'picked_up'].includes(e.status)
  ).length;
  const totalTokens = (ledger.data || []).reduce(
    (sum, e) => sum + (e.entry_type === 'credit' ? e.amount : -e.amount),
    0
  );
  const pendingRecycling = (recycling.data || []).filter((r) => r.status === 'pending').length;
  const openReports = (reports.data || []).filter((r) => r.status === 'open').length;

  return { totalUsers, activeExchanges, totalTokens, pendingRecycling, totalRatings: ratings.count || 0, openReports };
}

getStats().then(console.log).catch(console.error);
