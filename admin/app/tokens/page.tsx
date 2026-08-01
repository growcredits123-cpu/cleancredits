import { getAdminClient } from '@/lib/supabase';
import IssueTokensForm from './form';

export const dynamic = 'force-dynamic';

async function getRecentTopups() {
  const adminSupabase = getAdminClient();
  const { data } = await adminSupabase
    .from('ledger_entries')
    .select('id, user_id, amount, note, created_at, user:users!ledger_entries_user_id_fkey(name, email)')
    .eq('entry_kind', 'manual_topup')
    .order('created_at', { ascending: false })
    .limit(15);
  return data || [];
}

export default async function TokensPage() {
  const topups = await getRecentTopups();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Issue Tokens</h1>
      <p className="text-gray-500 mb-8">Credit tokens to a user's wallet (manual topup).</p>

      <div className="max-w-xl">
        <IssueTokensForm />
      </div>

      <h2 className="font-bold text-lg mt-10 mb-4">Recent Manual Topups</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Note</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {topups.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No manual topups yet</td></tr>
            ) : (
              topups.map((t: any) => (
                <tr key={t.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">{t.user?.name || 'Unknown'} <span className="text-gray-400">({t.user?.email})</span></td>
                  <td className="px-4 py-3 font-bold text-eco-600">+{t.amount} ◆</td>
                  <td className="px-4 py-3 text-gray-600">{t.note || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
