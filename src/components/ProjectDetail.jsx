import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

const STAGES = ['Under Review','Sent','Pending Award','Won','Lost','No Bid / Cancelled'];
const STAGE_COLORS = {
  'Under Review': 'bg-orange-500',
  'Sent': 'bg-green-500',
  'Pending Award': 'bg-purple-500',
  'Won': 'bg-yellow-500',
  'Lost': 'bg-red-500',
  'No Bid / Cancelled': 'bg-gray-500',
};

const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const noSpin = 'appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

function Field({ label, value, children }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-gray-200">{children || value || '—'}</div>
    </div>
  );
}

function EditableField({ label, value, onSave, type = 'text', prefix = '' }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);

  const commit = () => {
    onSave(v);
    setEditing(false);
  };

  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      {editing ? (
        <div className="flex gap-1">
          <input
            autoFocus
            type={type}
            value={v}
            onChange={e => setV(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className={`flex-1 bg-gray-700 border border-orange-500 rounded px-2 py-1 text-sm focus:outline-none ${type === 'number' ? noSpin : ''}`}
          />
        </div>
      ) : (
        <div
          onClick={() => { setV(value); setEditing(true); }}
          className="text-sm text-gray-200 cursor-pointer hover:text-orange-400 transition-colors group flex items-center gap-1"
        >
          {value ? `${prefix}${type === 'number' ? Number(value).toLocaleString() : value}` : <span className="text-gray-600 italic">Click to edit</span>}
          <span className="opacity-0 group-hover:opacity-100 text-xs transition-opacity">✏</span>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────
function OverviewTab({ project, onUpdate }) {
  const isLost = project.stage === 'Lost';
  const diff = project.ssiPrice - project.winnerPrice;
  const pct = project.winnerPrice ? ((diff / project.winnerPrice) * 100).toFixed(1) : null;

  const save = (field) => (val) => onUpdate({ [field]: val });

  return (
    <div className="space-y-6 py-4">
      {/* General */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">General</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Estimator" value={project.estimator} />
          <Field label="Tonnage" value={project.tonnage ? `${project.tonnage} tons` : null} />
          <Field label="Addenda" value={project.addenda} />
          <Field label="Distance" value={project.distance} />
          <Field label="Sales Tax" value={project.salesTax} />
          <Field label="Prevailing Wages" value={project.prevWages} />
        </div>
      </section>

      {/* Pricing */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pricing</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="FAB Cost" value={project.fabCost ? fmt(project.fabCost) : null} />
          <Field label="Erect Cost" value={project.erectCost ? fmt(project.erectCost) : null} />
          <Field label="SSI Price" value={fmt(project.ssiPrice)} />
        </div>
      </section>

      {/* Award Info */}
      <section>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Award Info</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <EditableField label="Awarded GC" value={project.awardedGC} onSave={save('awardedGC')} />
          <EditableField label="Steel Sub" value={project.awardedSub} onSave={save('awardedSub')} />
          <EditableField label="Awarded Price" value={project.awardedPrice} onSave={v => save('awardedPrice')(Number(v))} type="number" prefix="$" />
          <EditableField label="Awarded GC Contact" value={project.awardedGCContact} onSave={save('awardedGCContact')} />
          <EditableField label="Awarded GC Phone" value={project.awardedGCPhone} onSave={save('awardedGCPhone')} />
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Awarded GC Email</div>
            {project.awardedGCEmail
              ? <a href={`mailto:${project.awardedGCEmail}`} className="text-sm text-orange-400 hover:text-orange-300 transition-colors">✉ {project.awardedGCEmail}</a>
              : <EditableField label="" value={project.awardedGCEmail} onSave={save('awardedGCEmail')} />}
          </div>
          <div className="col-span-2">
            <EditableField label="Award Notes" value={project.awardNotes} onSave={save('awardNotes')} />
          </div>
        </div>
      </section>

      {/* Lost Bid Comparison */}
      {isLost && (
        <section className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Lost Bid Comparison</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <EditableField label="Our Tonnage" value={project.ourTonnage} onSave={v => save('ourTonnage')(Number(v))} type="number" />
            <EditableField label="Winning Sub Tonnage" value={project.winnerTonnage} onSave={v => save('winnerTonnage')(Number(v))} type="number" />
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Our Price</div>
              <div className="text-sm text-gray-200">{fmt(project.ssiPrice)}</div>
            </div>
            <EditableField label="Winning Sub Price" value={project.winnerPrice} onSave={v => save('winnerPrice')(Number(v))} type="number" prefix="$" />
          </div>
          {pct && (
            <div className={`mt-3 text-sm font-semibold ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {diff > 0 ? 'We were' : 'We were'}{' '}
              {fmt(Math.abs(diff))} ({Math.abs(pct)}%) {diff > 0 ? 'over' : 'under'} the winner
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Companies Tab ─────────────────────────────────────────
function CompaniesTab({ project, onEditCompanies }) {
  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GCs & Contacts</h3>
        <button onClick={onEditCompanies} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">✏ Edit GCs</button>
      </div>
      {project.companies?.length === 0 && (
        <p className="text-sm text-gray-600 italic">No companies added yet.</p>
      )}
      {project.companies?.map((gc, i) => (
        <div key={i} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="font-semibold text-gray-100 mb-3">{gc.name}</div>
          {gc.contacts?.map((c, j) => (
            <div key={j} className="text-sm space-y-1 border-t border-gray-700/50 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
              <div className="font-medium text-gray-200">{c.name}</div>
              {c.email && <div><a href={`mailto:${c.email}`} className="text-orange-400 hover:text-orange-300 transition-colors text-xs">{c.email}</a></div>}
              {c.officePhone && <div className="text-gray-400 text-xs">📞 {c.officePhone}{c.ext ? ` x${c.ext}` : ''}</div>}
              {c.cell && <div className="text-gray-400 text-xs">📱 {c.cell}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────
function ActivityTab({ project, staff, currentStaff, onAddNote }) {
  const [text, setText] = useState('');
  const [role, setRole] = useState('Estimator');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onAddNote(project.id, currentStaff.id, role, text.trim());
      setText('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-4 flex flex-col gap-4">
      {/* Add note */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a note…"
          rows={3}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder-gray-600"
        />
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            {['Estimator', 'Sales'].map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  role === r ? 'bg-orange-500 border-orange-400 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-400'
                }`}
              >{r}</button>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            {saving ? 'Adding…' : 'Add Note'}
          </button>
        </div>
      </div>

      {/* Notes feed */}
      <div className="space-y-3">
        {[...(project.notes || [])].reverse().map(n => (
          <div key={n.id} className="flex gap-3">
            <div className={`w-1.5 rounded-full self-stretch flex-shrink-0 ${n.role === 'Estimator' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold ${n.role === 'Estimator' ? 'text-blue-400' : 'text-emerald-400'}`}>{n.author}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${n.role === 'Estimator' ? 'bg-blue-900/40 text-blue-400' : 'bg-emerald-900/40 text-emerald-400'}`}>{n.role}</span>
                <span className="text-xs text-gray-600 ml-auto">{new Date(n.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{n.text}</p>
            </div>
          </div>
        ))}
        {!project.notes?.length && <p className="text-sm text-gray-600 italic">No activity yet.</p>}
      </div>
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────
function TasksTab({ project, staff, currentStaff, isManager, onAddTask, onUpdateTask }) {
  const [form, setForm] = useState({ title: '', description: '', assigneeId: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const assign = async () => {
    if (!form.title || !form.assigneeId) return;
    setSaving(true);
    const assignee = staff.find(s => s.id === form.assigneeId);
    try {
      await onAddTask(project.id, {
        title: form.title,
        description: form.description,
        assignee_id: form.assigneeId,
        assigned_by_id: currentStaff.id,
        due_date: form.dueDate || null,
      });
      // Open email
      const mailto = `mailto:${assignee?.email}?subject=Task: ${encodeURIComponent(form.title)}&body=${encodeURIComponent(`Hi ${assignee?.name},\n\nYou've been assigned a task on project ${project.name} (${project.eName}).\n\nTask: ${form.title}\n${form.description ? `Details: ${form.description}\n` : ''}${form.dueDate ? `Due: ${form.dueDate}\n` : ''}\nPlease log in to the CRM to update the task status.\n\n— ${currentStaff.name}`)}`;
      window.open(mailto);
      setForm({ title: '', description: '', assigneeId: '', dueDate: '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-4 space-y-4">
      {/* Assign form — managers only */}
      {isManager && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Assign Task</div>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Task title"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-orange-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assignee</label>
              <select
                value={form.assigneeId}
                onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Select person…</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Due Date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <button
            onClick={assign}
            disabled={saving || !form.title || !form.assigneeId}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Assigning…' : '📧 Assign & Send Email'}
          </button>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {project.tasks?.map(t => (
          <div key={t.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{t.title}</div>
                {t.description && <div className="text-xs text-gray-400 mt-0.5">{t.description}</div>}
              </div>
              <select
                value={t.status}
                onChange={e => onUpdateTask(project.id, t.id, { status: e.target.value })}
                className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 focus:outline-none flex-shrink-0"
              >
                {['Open', 'In Progress', 'Done'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {t.assigneeEmail
                ? <a href={`mailto:${t.assigneeEmail}`} className="text-orange-400 hover:text-orange-300 transition-colors">{t.assignee}</a>
                : <span>{t.assignee}</span>}
              {t.dueDate && <span>Due: {fmtDate(t.dueDate)}</span>}
              <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${
                t.status === 'Done' ? 'bg-green-900/40 text-green-400' :
                t.status === 'In Progress' ? 'bg-yellow-900/40 text-yellow-400' :
                'bg-gray-700 text-gray-400'
              }`}>{t.status}</span>
            </div>
          </div>
        ))}
        {!project.tasks?.length && <p className="text-sm text-gray-600 italic">No tasks yet.</p>}
      </div>
    </div>
  );
}

// ── Main ProjectDetail ────────────────────────────────────
export default function ProjectDetail({ project, staff, onClose, onUpdate, onAddNote, onAddTask, onUpdateTask, onUpdateStage }) {
  const { staff: currentStaff, isManager } = useAuth();
  const [tab, setTab] = useState('overview');

  if (!project) return null;

  const openTasks = project.tasks?.filter(t => t.status !== 'Done').length || 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="text-xs text-gray-500 font-mono">{project.eName || '—'} · {project.type}</div>
              <h2 className="font-bold text-lg leading-tight mt-0.5">{project.name}</h2>
              <div className="text-sm text-gray-400 mt-0.5">{project.city}, {project.state} · Bid {fmtDate(project.bidDate)}</div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none flex-shrink-0 transition-colors">×</button>
          </div>

          {/* Stage pills */}
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map(s => {
              const active = project.stage === s;
              return (
                <button
                  key={s}
                  onClick={() => isManager && onUpdateStage(project.id, s)}
                  title={isManager ? '' : '🔒 Managers only'}
                  className={`text-xs px-3 py-1 rounded-full border transition-all font-medium ${
                    active
                      ? `${STAGE_COLORS[s]} text-white border-transparent ring-2 ring-orange-400 ring-offset-1 ring-offset-gray-900`
                      : isManager
                        ? 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400'
                        : 'bg-gray-800 border-gray-700 text-gray-600 cursor-default'
                  }`}
                >
                  {!isManager && active && '🔒 '}{s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'companies', label: 'Companies' },
            { id: 'activity', label: `Activity${project.notes?.length ? ` (${project.notes.length})` : ''}` },
            { id: 'tasks', label: `Tasks${openTasks ? ` (${openTasks})` : ''}` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-orange-500 text-orange-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6">
          {tab === 'overview' && <OverviewTab project={project} onUpdate={upd => onUpdate(project.id, upd)} />}
          {tab === 'companies' && <CompaniesTab project={project} onEditCompanies={() => {}} />}
          {tab === 'activity' && <ActivityTab project={project} staff={staff} currentStaff={currentStaff} onAddNote={onAddNote} />}
          {tab === 'tasks' && <TasksTab project={project} staff={staff} currentStaff={currentStaff} isManager={isManager} onAddTask={onAddTask} onUpdateTask={onUpdateTask} />}
        </div>
      </div>
    </div>
  );
}
