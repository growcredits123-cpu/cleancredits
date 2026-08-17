'use client';

import { useState } from 'react';
import { updateUser, toggleRequireID } from '../actions';

export function UserCard({ user }: { user: any }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [saving, setSaving] = useState(false);
  const [requireId, setRequireId] = useState(user.id_verified === false);

  async function handleSave() {
    setSaving(true);
    await updateUser(user.id, name, email);
    setEditing(false);
    setSaving(false);
  }

  async function handleToggleId() {
    await toggleRequireID(user.id, !requireId);
    setRequireId(!requireId);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-blue-700">{user.name?.charAt(0) || 'U'}</span>
          )}
        </div>
        <button 
          onClick={() => setEditing(!editing)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      ) : (
        <>
          <h3 className="font-bold text-lg text-gray-900">{name || 'Unnamed User'}</h3>
          <p className="text-sm text-gray-500 mb-4">{email}</p>
          
          <div className="grid grid-cols-2 gap-2 text-sm mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div>
              <p className="text-gray-500 text-xs">Rating</p>
              <p className="font-semibold">{(user.rating_avg || 0).toFixed(1)} <span className="text-gray-400 font-normal">({user.reviews_count || 0})</span></p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Status</p>
              <p className="font-semibold">{user.is_blocked ? <span className="text-red-600">Blocked</span> : <span className="text-green-600">Active</span>}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">ID Verified</p>
              <p className="font-semibold">{user.id_verified ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Joined</p>
              <p className="font-semibold">{new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={requireId} 
                onChange={handleToggleId}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Require ID Upload</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Forces this user to upload identification before using the app.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
