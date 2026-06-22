import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

// This panel shows when clicking a "Projects in Review" card
// It has the intake-specific fields and Pursue/No Bid buttons

export default function IntakePanel({ project, staff, onUpdate, onUpdateStage, onClose }) {
  const { isManager } = useAuth();
  const [draft, setDraft] = useState({
    sources: project.intakeSources || [],
    projectUrl: project.projectUrl || '',
    intakeNotes: project.intakeNotes || '',
    estimatorId: project.estimatorId || '',
  });
  const [saving, setSaving] = useState(false);
  const [pursuing, setPursuing] = useState(false);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const toggleSource = (src) => {
    const sources = draft.sources.includes(src)
      ? draft.sources.filter(s => s !== src)
      : [...draft.sources, src];
    set('sources', sources);
  };

  const estimators = staff.filter(s => s.roles?.includes('Estimator'));

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(project.id, {
        intake_sources: draft.sources.join(','),
        project_url: draft.projectUrl,
        intake_notes: draft.intakeNotes,
        estimator_id: draft.estimatorId || null,
      });
    } finally { setSaving(false); }
  };

  const pursue = async () => {
    setPursuing(true);
    try {
      await onUpdate(project.id, {
        intake_sources: draft.sources.join(','),
        project_url: draft.projectUrl,
        intake_notes: draft.intakeNotes,
        estimator_id: draft.estimatorId || null,
      });
      await onUpdateStage(project.id, 'WIP');
      onClose();
    } finally { setPursuing(false); }
  };

  const noBid = async () => {
    if (!window.confirm('Mark this project as No Bid / Cancelled? It will be saved for reference.')) return;
    await onUpdate(project.id, {
      intake_sources: draft.sources.join(','),
      project_url: draft.projectUrl,
      intake_notes: draft.intakeNotes,
    });
    await onUpdateStage(project.id, 'No Bid / Cancelled');
    onClose();
  };

  const ic = 'w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 text-gray-800 dark:text-gray-200';
  const lbl = 'text-xs text-gray-500 dark:text-gray-400 mb-1 block font-medium';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-orange-50 dark:bg-orange-900/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">Projects in Review</span>
              </div>
              <h2 className="font-bold text-lg text-gray-900 dark:text-white leading-tight">{project.name}</h2>
              <div className="text-sm text-gray-500 mt-0.5">{project.eName} · {project.city}, {project.state}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none flex-shrink-0">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Source checkboxes */}
          <div>
            <label className={lbl}>How did this come in?</label>
            <div className="flex gap-2 flex-wrap">
              {['From GC', 'From Sean', 'VIP'].map(src => (
                <button key={src} type="button" onClick={() => toggleSource(src)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    draft.sources.includes(src)
                      ? 'bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/20'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'
                  }`}>
                  {src === 'VIP' ? '⭐ VIP' : src === 'From GC' ? '🏗 From GC' : '👤 From Sean'}
                </button>
              ))}
            </div>
            {draft.sources.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Select one or more — can be multiple</p>
            )}
          </div>

          {/* Project URL */}
          <div>
            <label className={lbl}>Project Drawings / Documents Link</label>
            <div className="flex gap-2">
              <input
                value={draft.projectUrl}
                onChange={e => set('projectUrl', e.target.value)}
                className={ic + ' flex-1'}
                placeholder="https://..."
                type="url"
              />
              {draft.projectUrl && (
                <a href={draft.projectUrl} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0">
                  Open ↗
                </a>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">Paste a link to the project page, bid docs, or drawings</p>
          </div>

          {/* Intake notes */}
          <div>
            <label className={lbl}>Notes</label>
            <textarea
              value={draft.intakeNotes}
              onChange={e => set('intakeNotes', e.target.value)}
              rows={4}
              className={ic + ' resize-none'}
              placeholder="Why are we considering this project? Any context, concerns, or special requirements…"
            />
          </div>

          {/* Assign estimator (optional at intake) */}
          <div>
            <label className={lbl}>Pre-assign Estimator (optional — can be claimed in WIP)</label>
            <select value={draft.estimatorId} onChange={e => set('estimatorId', e.target.value)} className={ic}>
              <option value="">— Leave for self-claim —</option>
              {estimators.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Project info summary */}
          <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 text-sm space-y-1.5">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Project Summary</div>
            {project.bidDate && <div className="flex justify-between"><span className="text-gray-500">Bid Date</span><span className="text-gray-800 dark:text-gray-200 font-medium">{new Date(project.bidDate+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span></div>}
            {project.type && <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-800 dark:text-gray-200">{project.type}</span></div>}
            {project.distance && <div className="flex justify-between"><span className="text-gray-500">Distance</span><span className="text-gray-800 dark:text-gray-200">{project.distance}</span></div>}
            {project.ssiPrice > 0 && <div className="flex justify-between"><span className="text-gray-500">SSI Price</span><span className="text-gray-800 dark:text-gray-200 font-semibold">${Number(project.ssiPrice).toLocaleString()}</span></div>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex gap-3">
            <button onClick={pursue} disabled={pursuing || !isManager}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-500/20 text-sm">
              {pursuing ? 'Moving to WIP…' : '✓ Pursue — Move to WIP'}
            </button>
            <button onClick={noBid} disabled={!isManager}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm">
              ✕ No Bid
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm">
              {saving ? 'Saving…' : 'Save Notes Only'}
            </button>
            <button onClick={onClose} className="flex-1 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 font-medium rounded-xl transition-colors text-sm">
              Close
            </button>
          </div>
          {!isManager && <p className="text-xs text-center text-gray-400">Only Managers can pursue or decline projects</p>}
        </div>
      </div>
    </div>
  );
}
