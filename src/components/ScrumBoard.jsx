import { useState, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const BOARD_STAGES = [
  { id: 'Projects in Review', label: 'Projects in Review', color: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', desc: 'New opportunities awaiting Go/No-Go decision' },
  { id: 'Open Queue', label: 'Open Queue', color: 'bg-sky-500', light: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-200 dark:border-sky-800', desc: 'Approved — available for estimators to self-claim' },
  { id: 'WIP', label: 'WIP', color: 'bg-blue-600', light: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800', desc: 'Actively being estimated' },
  { id: 'Sent', label: 'Sent', color: 'bg-green-500', light: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800', desc: 'Submitted to GC — awaiting award' },
  { id: 'GC Awarded', label: 'GC Awarded', color: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800', desc: 'GC has been awarded, tracking outcome' },
];

const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const fmtTs = ts => ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T12:00:00'); d.setHours(0,0,0,0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

// ── Claim Log Modal ────────────────────────────────────────
function ClaimLogModal({ project, onClose }) {
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useState(() => {
    supabase
      .from('claim_log')
      .select('*, staff:staff_id(name)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setLog(data || []); setLoading(false); });
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Claim Log</h3>
            <p className="text-xs text-gray-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl">×</button>
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {loading && <div className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</div>}
          {!loading && log?.length === 0 && <div className="px-6 py-8 text-center text-gray-400 text-sm">No claim history yet.</div>}
          {log?.map(entry => (
            <div key={entry.id} className="px-6 py-3 flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                entry.action === 'claimed' ? 'bg-green-500' :
                entry.action === 'released' ? 'bg-red-400' :
                entry.action === 'escalated' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{entry.staff?.name || 'Unknown'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    entry.action === 'claimed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    entry.action === 'released' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                    entry.action === 'escalated' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  }`}>{entry.action}</span>
                  <span className="text-xs text-gray-400 ml-auto">{fmtTs(entry.created_at)}</span>
                </div>
                {entry.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">"{entry.reason}"</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          {project.timesReleased > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">⚠ Released {project.timesReleased} time{project.timesReleased > 1 ? 's' : ''}{project.timesReleased >= 2 ? ' — escalated to Senior Estimator' : ''}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Release Modal ──────────────────────────────────────────
function ReleaseModal({ project, currentStaff, onRelease, onClose }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onRelease(project, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Release Bid</h3>
        <p className="text-sm text-gray-500 mb-4">{project.name} — this returns it to the Open Queue for another estimator to claim.</p>
        <label className="text-xs text-gray-500 mb-1.5 block font-medium">Reason (optional but helpful)</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="e.g. Out of bandwidth, Missing specs from GC, Outside my expertise…"
          className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 font-medium">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
            {saving ? 'Releasing…' : 'Release to Open Queue'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Board Card ─────────────────────────────────────────────
function BoardCard({ project, staff, currentStaff, isManager, onClaim, onRelease, onMoveStage, onOpenDetail, onViewLog }) {
  const [dragging, setDragging] = useState(false);
  const days = daysUntil(project.bidDate);
  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days >= 0 && days <= 3;
  const isMyClaim = project.claimedById === currentStaff?.id;
  const claimedByName = staff.find(s => s.id === project.claimedById)?.name;

  return (
    <div
      draggable={isManager}
      onDragStart={e => { e.dataTransfer.setData('projectId', project.id); setDragging(true); }}
      onDragEnd={() => setDragging(false)}
      className={`bg-white dark:bg-gray-800 rounded-xl border transition-all cursor-pointer select-none
        ${dragging ? 'opacity-50 scale-95' : 'hover:shadow-md hover:-translate-y-0.5'}
        ${isOverdue ? 'border-red-300 dark:border-red-700' : isUrgent ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-700'}
      `}>
      {/* Card top — click to open detail */}
      <div onClick={() => onOpenDetail(project.id)} className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-mono text-gray-400">{project.eName || '—'}</span>
          {project.timesReleased > 0 && (
            <button onClick={e => { e.stopPropagation(); onViewLog(project); }}
              className="text-xs text-amber-500 hover:text-amber-400 font-medium flex-shrink-0">
              ↩{project.timesReleased}
            </button>
          )}
        </div>
        <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-tight line-clamp-2 mb-2">{project.name}</div>
        <div className="text-xs text-gray-500">{project.city}, {project.state}</div>
        {project.bidDate && (
          <div className={`text-xs font-medium mt-1 ${isOverdue ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-gray-500'}`}>
            Bid: {fmtDate(project.bidDate)}{days !== null && <span className="ml-1">({days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`})</span>}
          </div>
        )}
        {project.ssiPrice > 0 && <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-1">{fmt(project.ssiPrice)}</div>}
        {project.estimator && <div className="text-xs text-gray-400 mt-1">Est: {project.estimator}</div>}

        {/* GC tags */}
        {project.companies?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.companies.slice(0,2).map((c,i) => (
              <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5">{c.name}</span>
            ))}
            {project.companies.length > 2 && <span className="text-xs text-gray-400">+{project.companies.length - 2}</span>}
          </div>
        )}

        {/* Intake source tags */}
        {project.intakeSources?.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {project.intakeSources.map(s => (
              <span key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${s === 'VIP' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {s === 'VIP' ? '⭐' : ''}{s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Claim section — only for Open Queue and WIP */}
      {(project.stage === 'Open Queue' || project.stage === 'WIP') && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
          {project.claimedById ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {claimedByName?.[0] || '?'}
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{claimedByName}</span>
              </div>
              {(isMyClaim || isManager) && (
                <button onClick={e => { e.stopPropagation(); onRelease(project); }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium">
                  Release
                </button>
              )}
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); onClaim(project); }}
              className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition-colors">
              Claim
            </button>
          )}
        </div>
      )}

      {/* Go/No-Go for Projects in Review */}
      {project.stage === 'Projects in Review' && isManager && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2 flex gap-2">
          <button onClick={e => { e.stopPropagation(); onMoveStage(project.id, 'Open Queue'); }}
            className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors">
            ✓ Pursue
          </button>
          <button onClick={e => { e.stopPropagation(); onMoveStage(project.id, 'No Bid / Cancelled'); }}
            className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors">
            ✕ No Bid
          </button>
        </div>
      )}
    </div>
  );
}

// ── Board Column ───────────────────────────────────────────
function BoardColumn({ stage, projects, staff, currentStaff, isManager, onClaim, onRelease, onMoveStage, onOpenDetail, onViewLog }) {
  const [dragOver, setDragOver] = useState(false);
  const total = projects.reduce((a, p) => a + (p.ssiPrice || 0), 0);

  return (
    <div
      className={`flex flex-col min-w-[240px] w-64 flex-shrink-0 rounded-xl transition-colors ${dragOver ? 'ring-2 ring-orange-400' : ''}`}
      onDragOver={e => { if (isManager) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        if (!isManager) return;
        const projectId = e.dataTransfer.getData('projectId');
        if (projectId) onMoveStage(projectId, stage.id);
      }}
    >
      {/* Column header */}
      <div className={`${stage.light} ${stage.border} border rounded-t-xl px-3 py-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${stage.color} flex-shrink-0`} />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">{stage.label}</span>
            <span className="text-xs text-gray-400 font-medium">({projects.length})</span>
          </div>
          {total > 0 && <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{fmt(total)}</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stage.desc}</p>
      </div>

      {/* Cards */}
      <div className={`${stage.light} ${stage.border} border border-t-0 rounded-b-xl flex-1 p-2 space-y-2 min-h-[120px]`}>
        {projects.map(p => (
          <BoardCard key={p.id} project={p} staff={staff} currentStaff={currentStaff} isManager={isManager}
            onClaim={onClaim} onRelease={onRelease} onMoveStage={onMoveStage}
            onOpenDetail={onOpenDetail} onViewLog={onViewLog} />
        ))}
        {projects.length === 0 && (
          <div className="text-xs text-gray-300 dark:text-gray-600 text-center py-6 italic">
            {dragOver ? 'Drop here' : 'No projects'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ScrumBoard ────────────────────────────────────────
export default function ScrumBoard({ projects, staff, actions, onOpenDetail }) {
  const { staff: currentStaff, isManager } = useAuth();
  const [releaseProject, setReleaseProject] = useState(null);
  const [logProject, setLogProject] = useState(null);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return projects;
    return projects.filter(p =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.eName || '').toLowerCase().includes(filter.toLowerCase()) ||
      p.estimator?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [projects, filter]);

  const handleClaim = async (project) => {
    if (!currentStaff?.id) return;
    // Log the claim
    await supabase.from('claim_log').insert({
      project_id: project.id,
      staff_id: currentStaff.id,
      action: 'claimed',
    });
    // Update project
    await actions.update(project.id, {
      claimed_by: currentStaff.id,
      estimator_id: currentStaff.id,
      stage: 'WIP',
    });
  };

  const handleRelease = async (project, reason) => {
    if (!currentStaff?.id) return;
    const newReleaseCount = (project.timesReleased || 0) + 1;
    // Log the release
    await supabase.from('claim_log').insert({
      project_id: project.id,
      staff_id: currentStaff.id,
      action: 'released',
      reason: reason || null,
    });
    // If released 2+ times, escalate — otherwise back to Open Queue
    const newStage = newReleaseCount >= 2 ? 'Open Queue' : 'Open Queue';
    await actions.update(project.id, {
      claimed_by: null,
      times_released: newReleaseCount,
      stage: newStage,
    });
    // If 2+ releases, also log escalation
    if (newReleaseCount >= 2) {
      await supabase.from('claim_log').insert({
        project_id: project.id,
        staff_id: currentStaff.id,
        action: 'escalated',
        reason: `Auto-escalated after ${newReleaseCount} releases`,
      });
    }
  };

  const handleMoveStage = async (projectId, stage) => {
    await actions.updateStage(projectId, stage);
  };

  return (
    <div className="space-y-4">
      {/* Board header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Bid Board</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isManager ? 'Drag cards between columns to move stages.' : 'Claim bids from Open Queue to start estimating.'}
          </p>
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter by project, E#, estimator…"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 w-56" />
      </div>

      {/* Board columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD_STAGES.map(stage => (
          <BoardColumn
            key={stage.id}
            stage={stage}
            projects={filtered.filter(p => p.stage === stage.id)}
            staff={staff}
            currentStaff={currentStaff}
            isManager={isManager}
            onClaim={handleClaim}
            onRelease={p => setReleaseProject(p)}
            onMoveStage={handleMoveStage}
            onOpenDetail={onOpenDetail}
            onViewLog={p => setLogProject(p)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"/><span>Bid date passed</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400"/><span>Bid in 3 days or less</span></div>
        <div className="flex items-center gap-1.5"><span className="text-amber-500 font-mono text-sm">↩2</span><span>Released 2 times — view log</span></div>
        <div className="flex items-center gap-1.5"><span>⭐</span><span>VIP project</span></div>
        {isManager && <div className="flex items-center gap-1.5"><span>⟺</span><span>Drag cards to move stages</span></div>}
      </div>

      {/* Modals */}
      {releaseProject && (
        <ReleaseModal project={releaseProject} currentStaff={currentStaff}
          onRelease={handleRelease} onClose={() => setReleaseProject(null)} />
      )}
      {logProject && (
        <ClaimLogModal project={logProject} onClose={() => setLogProject(null)} />
      )}
    </div>
  );
}
