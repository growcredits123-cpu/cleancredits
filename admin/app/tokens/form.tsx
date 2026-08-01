'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchUsers, issueTokens } from '../actions';
import { Search, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export default function IssueTokensForm() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const router = useRouter();

  async function search() {
    if (!query.trim()) return;
    const data = await searchUsers(query);
    setResults(data || []);
  }

  async function submit() {
    if (!selected) return;
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) return setFeedback({ ok: false, msg: 'Enter a valid amount.' });
    setBusy(true);
    const res = await issueTokens(selected.id, amt, note.trim());
    setBusy(false);
    if (!res.ok) return setFeedback({ ok: false, msg: res.msg as string });
    setFeedback({ ok: true, msg: `Credited ${amt} ◆ to ${selected.name}.` });
    router.refresh();
    setSelected(null);
    setQuery('');
    setResults([]);
    setAmount('');
    setNote('');
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">Search user</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Name or email…"
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
          />
          <button onClick={search} className="px-4 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {results.length > 0 && !selected && (
        <div className="space-y-1.5">
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-eco-500 transition-colors text-left"
            >
              <div>
                <div className="font-medium text-sm">{u.name}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              {u.is_blocked && <span className="text-xs font-bold text-red-500">BLOCKED</span>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="bg-eco-50 border border-eco-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">{selected.name}</div>
              <div className="text-xs text-gray-500">{selected.email}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-gray-500 hover:text-gray-700">Change</button>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Amount (tokens)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Promotional topup…"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-eco-500"
            />
          </div>
          <button
            onClick={submit}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-eco-500 text-white font-semibold py-2.5 rounded-lg hover:bg-eco-600 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {busy ? 'Issuing…' : 'Issue tokens'}
          </button>
        </div>
      )}

      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${feedback.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {feedback.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm font-medium">{feedback.msg}</span>
        </div>
      )}
    </div>
  );
}
