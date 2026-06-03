import { useState } from 'react';

const VARIABLES = ['{assignee_name}','{project_name}','{e_number}','{task_title}','{task_description}','{due_date}','{assigned_by}'];

export default function EmailTemplateModal({ current, onSave, onClose }) {
  const [template, setTemplate] = useState(current || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave('task_email_template', template);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const insert = (v) => setTemplate(t => t + v);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Task Email Template</h2>
            <p className="text-xs text-gray-500 mt-0.5">Customize the email sent when a task is assigned</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl transition-colors">×</button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Available Variables</label>
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map(v => (
                <button key={v} onClick={() => insert(v)}
                  className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors font-mono">
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Click a variable to insert it at the end, or type it manually anywhere in the template.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Email Body</label>
            <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={14}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-orange-500 resize-none text-gray-800 dark:text-gray-200" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg font-semibold text-white transition-colors">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
