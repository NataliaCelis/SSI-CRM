import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';

const STAGES = ['Under Review','Sent','Pending Award','Won','Lost','No Bid / Cancelled'];
const STAGE_COLORS = {
  'Under Review':'bg-orange-500','Sent':'bg-green-500','Pending Award':'bg-purple-500',
  'Won':'bg-yellow-500','Lost':'bg-red-500','No Bid / Cancelled':'bg-gray-500',
};
const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// ── Editable inline field ──────────────────────────────────
function EF({ label, value, onSave, type = 'text', prefix = '', textarea = false }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? '');
  useEffect(() => { setV(value ?? ''); }, [value]);
  const commit = () => { onSave(type === 'number' ? Number(v) : v); setEditing(false); };
  const cls = 'w-full bg-gray-100 dark:bg-gray-700 border border-orange-500 rounded px-2 py-1 text-sm focus:outline-none';
  return (
    <div>
      {label && <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>}
      {editing ? (
        textarea
          ? <textarea autoFocus rows={3} value={v} onChange={e => setV(e.target.value)} onBlur={commit} className={cls + ' resize-none'} />
          : <input autoFocus type={type} value={v} onChange={e => setV(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} className={cls} />
      ) : (
        <div onClick={() => { setV(value ?? ''); setEditing(true); }} className="group flex items-center gap-1 cursor-pointer min-h-[24px]">
          <span className="text-sm text-gray-800 dark:text-gray-200">
            {value ? (type === 'number' && prefix ? `${prefix}${Number(value).toLocaleString()}` : value) : <span className="text-gray-400 italic text-xs">Click to edit</span>}
          </span>
          <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 transition-opacity">✏</span>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────
function OverviewTab({ project, onUpdate, onDelete, currentStaff, isManager }) {
  const isLost = project.stage === 'Lost';
  const [awardDraft, setAwardDraft] = useState({
    awardedGC: project.awardedGC, awardedGCContact: project.awardedGCContact,
    awardedGCPhone: project.awardedGCPhone, awardedGCEmail: project.awardedGCEmail,
    awardedSub: project.awardedSub, awardedPrice: project.awardedPrice,
    awardNotes: project.awardNotes, ourTonnage: project.ourTonnage,
    winnerTonnage: project.winnerTonnage, winnerPrice: project.winnerPrice,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAwardDraft({
      awardedGC: project.awardedGC, awardedGCContact: project.awardedGCContact,
      awardedGCPhone: project.awardedGCPhone, awardedGCEmail: project.awardedGCEmail,
      awardedSub: project.awardedSub, awardedPrice: project.awardedPrice,
      awardNotes: project.awardNotes, ourTonnage: project.ourTonnage,
      winnerTonnage: project.winnerTonnage, winnerPrice: project.winnerPrice,
    });
  }, [project]);

  const saveAward = async () => {
    setSaving(true);
    await onUpdate(project.id, {
      awardedGC: awardDraft.awardedGC, awardedGCContact: awardDraft.awardedGCContact,
      awardedGCPhone: awardDraft.awardedGCPhone, awardedGCEmail: awardDraft.awardedGCEmail,
      awardedSub: awardDraft.awardedSub, awardedPrice: Number(awardDraft.awardedPrice),
      awardNotes: awardDraft.awardNotes, ourTonnage: Number(awardDraft.ourTonnage),
      winnerTonnage: Number(awardDraft.winnerTonnage), winnerPrice: Number(awardDraft.winnerPrice),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const diff = (awardDraft.awardedPrice || 0) - (awardDraft.winnerPrice || 0);
  const pct = awardDraft.winnerPrice ? ((diff / awardDraft.winnerPrice) * 100).toFixed(1) : null;
  const tonnageDiff = (awardDraft.ourTonnage || 0) - (awardDraft.winnerTonnage || 0);

  const row = (label, value) => (
    <div key={label}>
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm text-gray-800 dark:text-gray-200">{value || '—'}</div>
    </div>
  );

  const inp = (label, field, type = 'text') => (
    <div key={field}>
      <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">{label}</label>
      <input type={type} value={awardDraft[field] || ''}
        onChange={e => setAwardDraft(d => ({ ...d, [field]: e.target.value }))}
        className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
    </div>
  );

  return (
    <div className="space-y-6 py-4">
      {/* Project fields — all editable */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Project Info</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <EF label="Project Name" value={project.name} onSave={v => onUpdate(project.id, { project_name: v })} />
          <EF label="Type" value={project.type} onSave={v => onUpdate(project.id, { project_type: v })} />
          <EF label="City" value={project.city} onSave={v => onUpdate(project.id, { city: v })} />
          <EF label="State" value={project.state} onSave={v => onUpdate(project.id, { state: v })} />
          <EF label="Bid Date" value={project.bidDate} onSave={v => onUpdate(project.id, { bid_date: v })} type="date" />
          <EF label="Addenda" value={project.addenda} onSave={v => onUpdate(project.id, { addenda: Number(v) })} type="number" />
          <EF label="Tonnage" value={project.tonnage} onSave={v => onUpdate(project.id, { tonnage: Number(v) })} type="number" />
          <EF label="SSI Price ($)" value={project.ssiPrice} onSave={v => onUpdate(project.id, { ssi_price: Number(v) })} type="number" prefix="$" />
          <EF label="FAB Cost ($)" value={project.fabCost} onSave={v => onUpdate(project.id, { fab_cost: Number(v) })} type="number" prefix="$" />
          <EF label="Erect Cost ($)" value={project.erectCost} onSave={v => onUpdate(project.id, { erect_cost: Number(v) })} type="number" prefix="$" />
          <EF label="Sales Tax" value={project.salesTax} onSave={v => onUpdate(project.id, { sales_tax: v })} />
          <EF label="Prevailing Wages" value={project.prevWages} onSave={v => onUpdate(project.id, { prevailing_wages: v })} />
          <EF label="Distance" value={project.distance} onSave={v => onUpdate(project.id, { distance_miles: parseFloat(v) || 0 })} />
          <EF label="Follow-Up Date" value={project.followUpDate} onSave={v => onUpdate(project.id, { follow_up_date: v })} type="date" />
          <div className="col-span-2">
            <EF label="Pre-Qual Notes" value={project.prequal} onSave={v => onUpdate(project.id, { prequal: v })} textarea />
          </div>
        </div>
      </section>

      {/* Award Info */}
      <section className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Award Info</h3>
        <div className="grid grid-cols-2 gap-3">
          {inp('Awarded GC', 'awardedGC')}
          {inp('Steel Sub', 'awardedSub')}
          {inp('Awarded Price ($)', 'awardedPrice', 'number')}
          {inp('Awarded GC Contact', 'awardedGCContact')}
          {inp('Awarded GC Phone', 'awardedGCPhone')}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Awarded GC Email</label>
            <div className="flex gap-2 items-center">
              <input type="email" value={awardDraft.awardedGCEmail || ''}
                onChange={e => setAwardDraft(d => ({ ...d, awardedGCEmail: e.target.value }))}
                className="flex-1 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
              {awardDraft.awardedGCEmail && <a href={`mailto:${awardDraft.awardedGCEmail}`} className="text-orange-500 text-xs hover:underline whitespace-nowrap">✉ Open</a>}
            </div>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Award Notes</label>
            <textarea rows={2} value={awardDraft.awardNotes || ''} onChange={e => setAwardDraft(d => ({ ...d, awardNotes: e.target.value }))}
              className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 resize-none" />
          </div>
        </div>
      </section>

      {/* Lost Bid Comparison — only for Lost */}
      {isLost && (
        <section className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3">Lost Bid Comparison</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Our Tonnage</label>
              <input type="number" value={awardDraft.ourTonnage || ''} onChange={e => setAwardDraft(d => ({ ...d, ourTonnage: e.target.value }))}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Winning Sub Tonnage</label>
              <input type="number" value={awardDraft.winnerTonnage || ''} onChange={e => setAwardDraft(d => ({ ...d, winnerTonnage: e.target.value }))}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Our Price (auto-filled)</label>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 py-1.5">{fmt(awardDraft.awardedPrice)}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 block">Winning Sub Price ($)</label>
              <input type="number" value={awardDraft.winnerPrice || ''} onChange={e => setAwardDraft(d => ({ ...d, winnerPrice: e.target.value }))}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          {pct && (
            <div className={`mt-3 p-3 rounded-lg text-sm font-semibold ${diff > 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'}`}>
              We were {fmt(Math.abs(diff))} ({Math.abs(pct)}%) {diff > 0 ? 'OVER' : 'UNDER'} the winner
              {tonnageDiff !== 0 && <span className="ml-3 font-normal text-xs opacity-80">| Tonnage diff: {Math.abs(tonnageDiff)} tons {tonnageDiff > 0 ? 'more' : 'less'} than winner</span>}
            </div>
          )}
        </section>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button onClick={saveAward} disabled={saving}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save All Changes'}
        </button>
        {isManager && (
          <button onClick={() => onDelete(project.id, currentStaff?.id)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold text-white transition-colors ml-auto">
            Delete Project
          </button>
        )}
      </div>
    </div>
  );
}

// ── Companies Tab ──────────────────────────────────────────
function CompaniesTab({ project, onSaveCompanies }) {
  const [editing, setEditing] = useState(false);
  const [companies, setCompanies] = useState(project.companies || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setCompanies(project.companies || []); }, [project.companies]);

  const newContact = () => ({ name: '', email: '', officePhone: '', ext: '', cell: '' });
  const newGC = () => ({ name: '', contacts: [newContact()] });

  const updateGC = (gi, field, val) => setCompanies(cs => cs.map((c, i) => i === gi ? { ...c, [field]: val } : c));
  const updateContact = (gi, ci, field, val) => setCompanies(cs => cs.map((c, i) => i === gi ? { ...c, contacts: c.contacts.map((ct, j) => j === ci ? { ...ct, [field]: val } : ct) } : c));
  const removeGC = gi => setCompanies(cs => cs.filter((_, i) => i !== gi));
  const removeContact = (gi, ci) => setCompanies(cs => cs.map((c, i) => i === gi ? { ...c, contacts: c.contacts.filter((_, j) => j !== ci) } : c));

  const save = async () => {
    setSaving(true);
    await onSaveCompanies(project.id, companies);
    setSaving(false); setEditing(false);
  };

  if (!editing) return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GCs & Contacts</h3>
        <button onClick={() => setEditing(true)} className="text-xs text-orange-500 hover:text-orange-400 transition-colors">✏ Edit GCs</button>
      </div>
      {companies.length === 0 && <p className="text-sm text-gray-400 italic">No companies added yet.</p>}
      {companies.map((gc, i) => (
        <div key={i} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-3">{gc.name}</div>
          {gc.contacts?.map((c, j) => (
            <div key={j} className="text-sm space-y-1 border-t border-gray-200 dark:border-gray-700/50 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
              <div className="font-medium text-gray-800 dark:text-gray-200">{c.name}</div>
              {c.email && <a href={`mailto:${c.email}`} className="text-orange-500 hover:underline text-xs block">{c.email}</a>}
              {c.officePhone && <div className="text-gray-500 dark:text-gray-400 text-xs">📞 {c.officePhone}{c.ext ? ` x${c.ext}` : ''}</div>}
              {c.cell && <div className="text-gray-500 dark:text-gray-400 text-xs">📱 {c.cell}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const inpCls = 'w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500';

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Edit GCs & Contacts</h3>
        <button onClick={() => { setEditing(false); setCompanies(project.companies || []); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      {companies.map((gc, gi) => (
        <div key={gi} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input value={gc.name} onChange={e => updateGC(gi, 'name', e.target.value)}
              className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-orange-500"
              placeholder="GC Name" />
            <button onClick={() => removeGC(gi)} className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>
          </div>
          {gc.contacts?.map((c, ci) => (
            <div key={ci} className="grid grid-cols-2 gap-2 border-t border-gray-200 dark:border-gray-700/50 pt-3 relative">
              {gc.contacts.length > 1 && <button onClick={() => removeContact(gi, ci)} className="absolute right-0 top-3 text-red-400 hover:text-red-300 text-sm">×</button>}
              <div className="col-span-2"><input value={c.name} onChange={e => updateContact(gi, ci, 'name', e.target.value)} className={inpCls} placeholder="Contact Name" /></div>
              <input value={c.email} onChange={e => updateContact(gi, ci, 'email', e.target.value)} className={inpCls} placeholder="Email" />
              <div className="flex gap-1">
                <input value={c.officePhone} onChange={e => updateContact(gi, ci, 'officePhone', e.target.value)} className={inpCls} placeholder="Office Phone" />
                <input value={c.ext} onChange={e => updateContact(gi, ci, 'ext', e.target.value)} className="w-16 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Ext" />
              </div>
              <input value={c.cell} onChange={e => updateContact(gi, ci, 'cell', e.target.value)} className={inpCls} placeholder="Cell Phone" />
            </div>
          ))}
          <button onClick={() => setCompanies(cs => cs.map((c, i) => i === gi ? { ...c, contacts: [...c.contacts, newContact()] } : c))}
            className="text-xs text-gray-500 hover:text-orange-500 transition-colors">+ Add Contact</button>
        </div>
      ))}
      <button onClick={() => setCompanies(cs => [...cs, newGC()])} className="text-sm text-orange-500 hover:text-orange-400 transition-colors">+ Add GC</button>
      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors">
          {saving ? 'Saving…' : 'Save GCs'}
        </button>
      </div>
    </div>
  );
}

// ── Activity Tab ───────────────────────────────────────────
function ActivityTab({ project, currentStaff, isManager, onAddNote, onDeleteNote }) {
  const [text, setText] = useState('');
  const [role, setRole] = useState('Estimator');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim() || !currentStaff) return;
    setSaving(true);
    try { await onAddNote(project.id, currentStaff.id, role, text.trim()); setText(''); }
    finally { setSaving(false); }
  };

  return (
    <div className="py-4 flex flex-col gap-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a note…" rows={3}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-600 text-gray-800 dark:text-gray-200" />
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            {['Estimator', 'Sales'].map(r => (
              <button key={r} onClick={() => setRole(r)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${role === r ? 'bg-orange-500 border-orange-400 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'}`}>{r}</button>
            ))}
          </div>
          <button onClick={submit} disabled={saving || !text.trim()}
            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-medium text-white transition-colors">
            {saving ? 'Adding…' : 'Add Note'}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {[...(project.notes || [])].reverse().map(n => (
          <div key={n.id} className="flex gap-3 group">
            <div className={`w-1.5 rounded-full self-stretch flex-shrink-0 ${n.role === 'Estimator' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-semibold ${n.role === 'Estimator' ? 'text-blue-500' : 'text-emerald-500'}`}>{n.author}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${n.role === 'Estimator' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>{n.role}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(n.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {isManager && (
                  <button onClick={() => onDeleteNote(project.id, n.id, currentStaff?.id)}
                    className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-1">✕</button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{n.text}</p>
            </div>
          </div>
        ))}
        {!project.notes?.length && <p className="text-sm text-gray-400 italic">No activity yet.</p>}
      </div>
    </div>
  );
}

// ── Tasks Tab ──────────────────────────────────────────────
function TasksTab({ project, staff, currentStaff, isManager, onAddTask, onUpdateTask, onDeleteTask, emailTemplate }) {
  const [form, setForm] = useState({ title: '', description: '', assigneeId: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  const assign = async () => {
    if (!form.title || !form.assigneeId || !currentStaff) return;
    setSaving(true);
    const assignee = staff.find(s => s.id === form.assigneeId);
    try {
      await onAddTask(project.id, {
        title: form.title, description: form.description,
        assignee_id: form.assigneeId, assigned_by_id: currentStaff.id,
        due_date: form.dueDate || null,
      });
      // Build email from template
      const body = (emailTemplate || '').replace('{assignee_name}', assignee?.name || '').replace('{project_name}', project.name).replace('{e_number}', project.eName || '').replace('{task_title}', form.title).replace('{task_description}', form.description || 'N/A').replace('{due_date}', form.dueDate || 'Not set').replace('{assigned_by}', currentStaff.name || '');
      window.open(`mailto:${assignee?.email}?subject=${encodeURIComponent(`Task: ${form.title} — ${project.name}`)}&body=${encodeURIComponent(body)}`);
      setForm({ title: '', description: '', assigneeId: '', dueDate: '' });
    } finally { setSaving(false); }
  };

  const inpCls = 'w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500';

  return (
    <div className="py-4 space-y-4">
      {isManager && (
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign Task</div>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" className={inpCls} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" rows={2} className={inpCls + ' resize-none'} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Assignee</label>
              <select value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))} className={inpCls}>
                <option value="">Select person…</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inpCls} />
            </div>
          </div>
          <button onClick={assign} disabled={saving || !form.title || !form.assigneeId}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors">
            {saving ? 'Assigning…' : '📧 Assign & Send Email'}
          </button>
        </div>
      )}
      <div className="space-y-2">
        {project.tasks?.map(t => (
          <div key={t.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{t.title}</div>
                {t.description && <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>}
              </div>
              <div className="flex items-center gap-2">
                <select value={t.status} onChange={e => onUpdateTask(project.id, t.id, { status: e.target.value })}
                  className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none">
                  {['Open', 'In Progress', 'Done'].map(s => <option key={s}>{s}</option>)}
                </select>
                {isManager && (
                  <button onClick={() => onDeleteTask(project.id, t.id, currentStaff?.id)}
                    className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
              {t.assigneeEmail
                ? <a href={`mailto:${t.assigneeEmail}`} className="text-orange-500 hover:underline">{t.assignee}</a>
                : <span>{t.assignee}</span>}
              {t.dueDate && <span>Due: {fmtDate(t.dueDate)}</span>}
              <span className={`ml-auto px-1.5 py-0.5 rounded text-xs ${t.status === 'Done' ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : t.status === 'In Progress' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{t.status}</span>
            </div>
          </div>
        ))}
        {!project.tasks?.length && <p className="text-sm text-gray-400 italic">No tasks yet.</p>}
      </div>
    </div>
  );
}

// ── Main ProjectDetail ─────────────────────────────────────
export default function ProjectDetail({ project, staff, onClose, onUpdate, onUpdateStage, onDelete, onAddNote, onDeleteNote, onAddTask, onUpdateTask, onDeleteTask, onSaveCompanies, emailTemplate }) {
  const { staff: currentStaff, isManager } = useAuth();
  const [tab, setTab] = useState('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!project) return null;
  const openTasks = project.tasks?.filter(t => t.status !== 'Done').length || 0;

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await onDelete(project.id, currentStaff?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <div className="text-xs text-gray-400 font-mono">{project.eName || '—'} · {project.type}</div>
              <h2 className="font-bold text-lg leading-tight text-gray-900 dark:text-white mt-0.5">{project.name}</h2>
              <div className="text-sm text-gray-500 mt-0.5">{project.city}, {project.state} · Bid {fmtDate(project.bidDate)}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none transition-colors flex-shrink-0">×</button>
          </div>
          {/* Stage pills */}
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map(s => {
              const active = project.stage === s;
              return (
                <button key={s} onClick={() => isManager && onUpdateStage(project.id, s)}
                  title={isManager ? '' : 'Managers only'}
                  className={`text-xs px-3 py-1 rounded-full border transition-all font-medium ${active ? `${STAGE_COLORS[s]} text-white border-transparent ring-2 ring-orange-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900` : isManager ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-default'}`}>
                  {!isManager && active && '🔒 '}{s}
                </button>
              );
            })}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'companies', label: 'Companies' },
            { id: 'activity', label: `Activity${project.notes?.length ? ` (${project.notes.length})` : ''}` },
            { id: 'tasks', label: `Tasks${openTasks ? ` (${openTasks})` : ''}` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          {tab === 'overview' && <OverviewTab project={project} onUpdate={onUpdate} onDelete={handleDelete} currentStaff={currentStaff} isManager={isManager} />}
          {tab === 'companies' && <CompaniesTab project={project} onSaveCompanies={onSaveCompanies} />}
          {tab === 'activity' && <ActivityTab project={project} currentStaff={currentStaff} isManager={isManager} onAddNote={onAddNote} onDeleteNote={onDeleteNote} />}
          {tab === 'tasks' && <TasksTab project={project} staff={staff} currentStaff={currentStaff} isManager={isManager} onAddTask={onAddTask} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} emailTemplate={emailTemplate} />}
        </div>
        {confirmDelete && (
          <div className="px-6 py-3 border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex items-center justify-between">
            <span className="text-sm text-red-600 dark:text-red-400">Confirm delete? A backup copy will be saved.</span>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
              <button onClick={handleDelete} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold">Yes, Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
