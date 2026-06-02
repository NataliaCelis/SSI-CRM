import { useState } from 'react';
import { upsertStaff, deleteStaff } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const ALL_ROLES = ['Manager', 'Sales Manager', 'Estimator', 'Sales'];

function RolePills({ selected, onChange }) {
  const toggle = r => onChange(
    selected.includes(r) ? selected.filter(x => x !== r) : [...selected, r]
  );
  return (
    <div className="flex flex-wrap gap-1">
      {ALL_ROLES.map(r => (
        <button
          key={r}
          type="button"
          onClick={() => toggle(r)}
          className={`text-xs px-2 py-0.5 rounded border transition-colors ${
            selected.includes(r)
              ? 'bg-orange-500 border-orange-400 text-white'
              : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'
          }`}
        >{r}</button>
      ))}
    </div>
  );
}

export default function StaffDirectory({ staff, onClose, onSave }) {
  const { isFullManager } = useAuth();
  const [list, setList] = useState(staff.map(s => ({ ...s, roles: s.roles || [] })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (idx, field, val) => setList(l => l.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const addMember = () => setList(l => [...l, { name: '', email: '', roles: [] }]);

  const remove = async (idx) => {
    const s = list[idx];
    if (s.id && !confirm(`Remove ${s.name}?`)) return;
    if (s.id) {
      setSaving(true);
      try { await deleteStaff(s.id); } catch (e) { setError(e.message); setSaving(false); return; }
      setSaving(false);
    }
    setList(l => l.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      for (const s of list) {
        if (!s.name || !s.email) continue;
        await upsertStaff(s);
      }
      onSave(list);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-lg">👥 Staff Directory</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage team members and their roles</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none transition-colors">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {list.map((s, i) => (
            <div key={s.id || i} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Name</label>
                  <input
                    value={s.name}
                    onChange={e => update(i, 'name', e.target.value)}
                    disabled={!isFullManager}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60"
                    placeholder="Name"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Email</label>
                  <input
                    value={s.email}
                    onChange={e => update(i, 'email', e.target.value)}
                    disabled={!isFullManager}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-60"
                    placeholder="email@company.com"
                  />
                </div>
                {isFullManager && (
                  <button onClick={() => remove(i)} className="self-end text-red-400 hover:text-red-300 text-lg leading-none pb-2 transition-colors">×</button>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Roles</label>
                <RolePills
                  selected={s.roles}
                  onChange={roles => update(i, 'roles', roles)}
                />
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-6 mb-2 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-3">
          {isFullManager && (
            <button onClick={addMember} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
              + Add Staff Member
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg font-medium transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
