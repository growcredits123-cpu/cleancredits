'use client';

import { useState } from 'react';
import { toggleBlockUser, removeListing, resolveReport } from '../actions';
import { Ban, CheckCircle2, Trash2, Flag, Package, Users } from 'lucide-react';

interface Props {
  users: any[];
  items: any[];
  reports: any[];
}

type Tab = 'users' | 'listings' | 'reports';

export default function ModerationClient({ users, items, reports }: Props) {
  const [tab, setTab] = useState<Tab>('reports');
  const [userState, setUserState] = useState(users);
  const [itemState, setItemState] = useState(items);
  const [reportState, setReportState] = useState(reports);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleBlock(user: any) {
    setBusy(user.id);
    const { error } = await toggleBlockUser(user.id, user.is_blocked);
    setBusy(null);
    if (!error) setUserState((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_blocked: !u.is_blocked } : u)));
  }

  async function removeListing(item: any) {
    setBusy(item.id);
    const { error } = await removeListing(item.id);
    setBusy(null);
    if (!error) setItemState((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'removed' } : i)));
  }

  async function resolveReport(report: any) {
    setBusy(report.id);
    const { error } = await resolveReport(report.id);
    setBusy(null);
    if (!error) setReportState((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: 'resolved' } : r)));
  }

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'reports', label: 'Reports', icon: Flag, count: reportState.filter((r) => r.status === 'open').length },
    { key: 'users', label: 'Users', icon: Users, count: userState.length },
    { key: 'listings', label: 'Listings', icon: Package, count: itemState.filter((i) => i.status !== 'removed').length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Moderation</h1>
      <p className="text-gray-500 mb-6">Manage users, listings, and reports.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-eco-500 text-eco-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {reportState.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No reports filed.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reported User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reported By</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {reportState.map((r: any) => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3">{r.reported?.name} <span className="text-gray-400">({r.reported?.email})</span></td>
                    <td className="px-4 py-3">{r.reporter?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.status === 'open' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'open' && (
                        <button onClick={() => resolveReport(r)} disabled={busy === r.id} className="text-xs font-semibold text-eco-600 hover:text-eco-700">Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Rating</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {userState.map((u: any) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">{u.rating_avg?.toFixed(1) || '—'} ★</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.is_blocked ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{u.is_blocked ? 'Blocked' : 'Active'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleBlock(u)} disabled={busy === u.id} className={`flex items-center gap-1 text-xs font-semibold ${u.is_blocked ? 'text-eco-600 hover:text-eco-700' : 'text-red-600 hover:text-red-700'}`}>
                      {u.is_blocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      {u.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'listings' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {itemState.map((i: any) => (
                <tr key={i.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{i.title}</td>
                  <td className="px-4 py-3 text-gray-500">{i.owner?.name || '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{i.status}</span></td>
                  <td className="px-4 py-3">
                    {i.status !== 'removed' && (
                      <button onClick={() => removeListing(i)} disabled={busy === i.id} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
                        <Trash2 className="w-3.5 h-3.5" />Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
