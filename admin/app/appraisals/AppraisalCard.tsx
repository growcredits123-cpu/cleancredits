'use client';

import { useState } from 'react';
import { resolveAppraisal } from '../actions';

export function AppraisalCard({ request }: { request: any }) {
  const [value, setValue] = useState('');
  const [resolving, setResolving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleResolve() {
    const val = parseInt(value, 10);
    if (isNaN(val) || val <= 0) return alert('Enter a valid token amount.');
    
    setResolving(true);
    await resolveAppraisal(request.id, val);
    setResolving(false);
    setDone(true);
  }

  if (done) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="mb-4 pb-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-900">{request.user?.name || 'Unknown User'}</h3>
        <p className="text-sm text-gray-500">{request.user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">{new Date(request.created_at).toLocaleString()}</p>
      </div>
      
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Item Description</p>
        <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">
          {request.payload?.description || 'No description provided.'}
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Appraised Token Value</label>
        <div className="flex gap-2">
          <input 
            type="number" 
            value={value} 
            onChange={e => setValue(e.target.value)} 
            placeholder="e.g. 50"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
          />
          <button 
            onClick={handleResolve} 
            disabled={resolving || !value}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {resolving ? 'Saving...' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}
