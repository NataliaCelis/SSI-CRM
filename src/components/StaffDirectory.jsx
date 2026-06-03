import { useState } from 'react';
import { upsertStaffMember, removeStaffMember } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const ALL_ROLES = ['Manager', 'Sales Manager', 'Estimator', 'Sales'];

export default function StaffDirectory({ staff, onClose, onSave }) {
  const { isFullManager, isManager, staff: currentStaff } = useAuth();
  const canEdit = isManager; // Sales managers can also edit
  const [list, setList] = useState(staff.map(s => ({ ...s, roles: s.roles || [] })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const update = (idx, field, val) => setList(l => l.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const toggleRole = (idx, role) => {
    const s = list[idx];
    const roles = s.roles.includes(role)
      ? s.roles.filter(r => r !== role)
      : [...s.roles, role];
    update(idx, 'roles', roles);
  };

  const addMember = () => setList(l => [...l, { name: '', email: '', roles: [] }]);

  const removeMember = async (idx) => {
    const s = list[idx];
    if (!window.confirm(`Remove ${s.name || 'this person'}? A backup will be saved.`)) return;
    setSaving(true);
    try {
      if (s.id) await removeStaffMember(s.id, currentStaff?.id);
      setList(l => l.filter((_, i) => i !== idx));
      setSuccess('Staff member removed.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Remove failed: ' + e.message);
    } finally { setSaving(false); }
  };

  const save = async () => {
    if (!canEdit) { setError('Only Managers can edit staff.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      for (const s of list) {
        if (!s.name?.trim() || !s.email?.trim()) continue;
        await upsertStaffMember(s);
      }
      await onSave();
      setSuccess('Saved successfully!');
      setTimeout(() => { setSuccess(''); onClose(); }, 1500);
    } catch (e) {
      setError('Save failed: ' + e.message + '. Make sure your account is linked in Supabase (auth_user_id set on staff row).');
    } finally { setSaving(false); }
  };

  const inpCls = 'w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50 text-gray-800 dark:text-gray-200';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Staff Directory</h2>
            <p className="text-xs text-gray-500 mt-0.5">Manage team members and their roles</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl transition-colors">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {list.map((s, i) => (
            <div key={s.id || i} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <input value={s.name} onChange={e => update(i, 'name', e.target.value)}
                    disabled={!canEdit} className={inpCls} placeholder="Name" />
                  <input value={s.email} onChange={e => update(i, 'email', e.target.value)}
                    disabled={!canEdit} className={inpCls} placeholder="email@company.com" />
                </div>
                {canEdit && (
                  <button onClick={() => removeMember(i)}
                    className="text-red-400 hover:text-red-300 text-xl leading-none mt-1 flex-shrink-0 transition-colors" title="Remove (backed up)">×</button>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Roles</label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.map(r => (
                    <button key={r} type="button"
                      onClick={() => canEdit && toggleRole(i, r)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        s.roles.includes(r)
                          ? 'bg-orange-500 border-orange-400 text-white'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                      } ${!canEdit ? 'cursor-default' : 'hover:border-orange-400 cursor-pointer'}`}>
                      {r} {s.roles.includes(r) && '✓'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mx-6 mb-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-6 mb-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
            {success}
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          {canEdit && (
            <button onClick={addMember} className="text-sm text-orange-500 hover:text-orange-400 transition-colors">
              + Add Staff Member
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
              Cancel
            </button>
            {canEdit && (
              <button onClick={save} disabled={saving}
                className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg font-semibold text-white transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
