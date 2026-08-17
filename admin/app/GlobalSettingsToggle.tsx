'use client';

import { useState } from 'react';
import { updateGlobalRequireId } from './actions';

export function GlobalSettingsToggle({ initialRequireId }: { initialRequireId: boolean }) {
  const [requireId, setRequireId] = useState(initialRequireId);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    const newValue = !requireId;
    setRequireId(newValue);
    setSaving(true);
    await updateGlobalRequireId(newValue);
    setSaving(false);
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <div>
        <h3 className="font-semibold text-gray-800">Require ID Verification for New Users</h3>
        <p className="text-sm text-gray-500 mt-1">If enabled, new users will be forced to upload their School or Govt ID.</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" checked={requireId} onChange={handleToggle} disabled={saving} />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}
