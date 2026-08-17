'use client';

import { useState } from 'react';
import { toggleBlockUser, removeListing, resolveReport } from '../actions';
import { Ban, CheckCircle2, Trash2, Flag, Package, Users, Edit2, Save, X, ShieldCheck, ShieldOff, Star } from 'lucide-react';

interface Props {
  users: any[];
  items: any[];
  reports: any[];
}

type Tab = 'users' | 'listings' | 'reports' | 'verifications';

export default function ModerationClient({ users, items, reports }: Props) {
  const [tab, setTab] = useState<Tab>('reports');
  const [userState, setUserState] = useState(users);
  const [itemState, setItemState] = useState(items);
  const [reportState, setReportState] = useState(reports);
  const [busy, setBusy] = useState<string | null>(null);
  const [idRequired, setIdRequired] = useState(false);

  // Inline user editor
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRating, setEditRating] = useState('');

  function startEdit(u: any) {
    setEditingUserId(u.id);
    setEditName(u.name || '');
    setEditEmail(u.email || '');
    setEditRating(u.rating_avg?.toFixed(1) || '0.0');
  }

  function cancelEdit() {
    setEditingUserId(null);
  }

  async function saveEdit(userId: string) {
    setBusy(userId);
    // Call supabase directly from admin (server action or API route could be used)
    const res = await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, name: editName, email: editEmail, rating_avg: parseFloat(editRating) }),
    });
    setBusy(null);
    if (res.ok) {
      setUserState(prev => prev.map(u => u.id === userId ? { ...u, name: editName, email: editEmail, rating_avg: parseFloat(editRating) } : u));
      setEditingUserId(null);
    } else {
      alert('Failed to update user.');
    }
  }

  async function handleVerifyId(userId: string, approve: boolean) {
    setBusy(userId);
    await fetch('/api/admin/update-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, id_verified: approve }),
    });
    setBusy(null);
    setUserState(prev => prev.map(u => u.id === userId ? { ...u, id_verified: approve } : u));
  }

  async function handleToggleBlock(user: any) {
    setBusy(user.id);
    const { error } = await toggleBlockUser(user.id, user.is_blocked);
    setBusy(null);
    if (!error) setUserState((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_blocked: !u.is_blocked } : u)));
  }

  async function handleRemoveListing(item: any) {
    setBusy(item.id);
    const { error } = await removeListing(item.id);
    setBusy(null);
    if (!error) setItemState((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'removed' } : i)));
  }

  async function handleResolveReport(report: any) {
    setBusy(report.id);
    const { error } = await resolveReport(report.id);
    setBusy(null);
    if (!error) setReportState((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: 'resolved' } : r)));
  }

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'reports', label: 'Reports', icon: Flag, count: reportState.filter((r) => r.status === 'open').length },
    { key: 'users', label: 'Users', icon: Users, count: userState.length },
    { key: 'listings', label: 'Listings', icon: Package, count: itemState.filter((i) => i.status !== 'removed').length },
    { key: 'verifications', label: 'Verifications', icon: ShieldCheck, count: userState.filter((u) => !u.id_verified).length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Moderation</h1>
      <p className="text-gray-500 mb-6">Manage users, listings, reports, and verifications.</p>

      <div className="flex gap-1 mb-6 border-b border-gray-200 flex-wrap">
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

      {/* REPORTS TAB */}
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
                        <button onClick={() => handleResolveReport(r)} disabled={busy === r.id} className="text-xs font-semibold text-eco-600 hover:text-eco-700">Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{userState.length} total users</p>
            <button
              onClick={() => setIdRequired(!idRequired)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white ${idRequired ? 'bg-eco-600' : 'bg-gray-400'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              ID Verification: {idRequired ? 'REQUIRED' : 'OPTIONAL'}
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rating</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ID Verified</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userState.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0 align-top">
                    {editingUserId === u.id ? (
                      <>
                        <td className="px-4 py-3">
                          <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editName} onChange={e => setEditName(e.target.value)} />
                        </td>
                        <td className="px-4 py-3">
                          <input className="border border-gray-300 rounded px-2 py-1 text-sm w-full" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                        </td>
                        <td className="px-4 py-3">
                          <input className="border border-gray-300 rounded px-2 py-1 text-sm w-20" value={editRating} onChange={e => setEditRating(e.target.value)} type="number" step="0.1" min="0" max="5" />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.id_verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                            {u.id_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.is_blocked ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{u.is_blocked ? 'Blocked' : 'Active'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => saveEdit(u.id)} disabled={busy === u.id} className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700">
                              <Save className="w-3.5 h-3.5" />Save
                            </button>
                            <button onClick={cancelEdit} className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
                              <X className="w-3.5 h-3.5" />Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                            {u.rating_avg?.toFixed(1) || '—'}
                            <span className="text-gray-400 text-xs">({u.reviews_count || 0})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.id_verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                              {u.id_verified ? 'Verified' : 'Unverified'}
                            </span>
                            {!u.id_verified && (
                              <button onClick={() => handleVerifyId(u.id, true)} disabled={busy === u.id} className="text-xs text-green-600 hover:text-green-700 font-semibold">Approve</button>
                            )}
                            {u.id_verified && (
                              <button onClick={() => handleVerifyId(u.id, false)} disabled={busy === u.id} className="text-xs text-red-500 hover:text-red-600 font-semibold">Revoke</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.is_blocked ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{u.is_blocked ? 'Blocked' : 'Active'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <button onClick={() => startEdit(u)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                              <Edit2 className="w-3.5 h-3.5" />Edit
                            </button>
                            <button onClick={() => handleToggleBlock(u)} disabled={busy === u.id} className={`flex items-center gap-1 text-xs font-semibold ${u.is_blocked ? 'text-eco-600 hover:text-eco-700' : 'text-red-600 hover:text-red-700'}`}>
                              {u.is_blocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                              {u.is_blocked ? 'Unblock' : 'Block'}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LISTINGS TAB */}
      {tab === 'listings' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Price</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {itemState.map((i: any) => (
                <tr key={i.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{i.title}</td>
                  <td className="px-4 py-3 text-gray-500">{i.owner?.name || '—'}</td>
                  <td className="px-4 py-3">{i.token_price === 0 ? <span className="text-green-600 font-semibold">FREE</span> : `${i.token_price} ◆`}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-600">{i.status}</span></td>
                  <td className="px-4 py-3">
                    {i.status !== 'removed' && (
                      <button onClick={() => handleRemoveListing(i)} disabled={busy === i.id} className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700">
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

      {/* VERIFICATIONS TAB */}
      {tab === 'verifications' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">Review and approve user identity documents.</p>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ID Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {userState.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.id_verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                        {u.id_verified ? '✓ Verified' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!u.id_verified && (
                          <button onClick={() => handleVerifyId(u.id, true)} disabled={busy === u.id} className="flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700">
                            <ShieldCheck className="w-3.5 h-3.5" />Approve ID
                          </button>
                        )}
                        {u.id_verified && (
                          <button onClick={() => handleVerifyId(u.id, false)} disabled={busy === u.id} className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600">
                            <ShieldOff className="w-3.5 h-3.5" />Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
