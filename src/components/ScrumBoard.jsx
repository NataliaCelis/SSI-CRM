import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

const BOARD_STAGES = [
  { id: 'Projects in Review', label: 'Projects in Review', color: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', desc: 'New opportunities awaiting Go/No-Go' },
  { id: 'Open Queue', label: 'Open Queue', color: 'bg-sky-500', light: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-200 dark:border-sky-800', desc: 'Approved — claim to start estimating' },
  { id: 'WIP', label: 'WIP', color: 'bg-blue-600', light: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800', desc: 'Actively being estimated' },
  { id: 'Sent', label: 'Sent', color: 'bg-green-500', light: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800', desc: 'Submitted to GC' },
  { id: 'GC Awarded', label: 'GC Awarded', color: 'bg-purple-500', light: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800', desc: 'GC awarded — tracking outcome' },
];

const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
const fmtTs = ts => ts ? new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

function addBusinessDays(date, days) {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T12:00:00'); d.setHours(0,0,0,0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function daysUntilLabel(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return null;
  if (d < 0) return { text: `${Math.abs(d)}d overdue`, urgent: true, expired: true };
  if (d === 0) return { text: 'Due today', urgent: true, expired: false };
  if (d === 1) return { text: 'Due tomorrow', urgent: true, expired: false };
  return { text: `${d}d remaining`, urgent: false, expired: false };
}

// ── Claim Log Modal ────────────────────────────────────────
function ClaimLogModal({ project, onClose }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('claim_log').select('*, staff:staff_id(name)')
      .eq('project_id', project.id).order('created_at', { ascending: false })
      .then(({ data }) => { setLog(data || []); setLoading(false); });
  }, [project.id]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">Claim History</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl">×</button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {loading && <div className="px-6 py-8 text-center text-gray-400 text-sm animate-pulse">Loading…</div>}
          {!loading && log.length === 0 && <div className="px-6 py-8 text-center text-gray-400 text-sm">No claim history yet.</div>}
          {log.map(entry => (
            <div key={entry.id} className="px-6 py-3 flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                entry.action==='claimed'?'bg-green-500':entry.action==='released'?'bg-red-400':
                entry.action==='expired'?'bg-amber-500':entry.action==='escalated'?'bg-orange-500':'bg-blue-500'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{entry.staff?.name||'System'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    entry.action==='claimed'?'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400':
                    entry.action==='released'?'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400':
                    entry.action==='expired'?'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400':
                    entry.action==='submitted'?'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400':
                    'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'}`}>{entry.action}</span>
                  <span className="text-xs text-gray-400 ml-auto">{fmtTs(entry.created_at)}</span>
                </div>
                {entry.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">"{entry.reason}"</p>}
              </div>
            </div>
          ))}
        </div>
        {project.timesReleased > 0 && (
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠ Released {project.timesReleased} time{project.timesReleased>1?'s':''}
              {project.timesReleased>=2?' — needs manager attention':''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Release Modal ──────────────────────────────────────────
function ReleaseModal({ project, onRelease, onClose }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const QUICK_REASONS = ['Out of bandwidth','Missing specs from GC','Outside my expertise','Bid date conflict','Reassigned by manager'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Release Bid Back to Queue</h3>
        <p className="text-sm text-gray-500 mb-4">{project.name} — another estimator can claim it from Open Queue.</p>
        <div className="text-xs text-gray-500 mb-2 font-medium">Quick reasons:</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${reason===r?'bg-orange-500 border-orange-400 text-white':'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'}`}>
              {r}
            </button>
          ))}
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
          placeholder="Or type a custom reason…"
          className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
          <button onClick={async () => { setSaving(true); await onRelease(project, reason); onClose(); }}
            disabled={saving}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
            {saving ? 'Releasing…' : 'Release'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── My Bids Banner ─────────────────────────────────────────
function MyBidsBanner({ myBids, onOpenDetail, onRelease, onSubmit }) {
  if (!myBids.length) return null;
  return (
    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
        <h3 className="font-bold text-sm text-blue-800 dark:text-blue-200">My Active Bids ({myBids.length})</h3>
        <span className="text-xs text-blue-500 dark:text-blue-400">— you are responsible for these</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {myBids.map(p => {
          const claimExpiry = daysUntilLabel(p.claimDueDate);
          const bidDeadline = daysUntilLabel(p.bidDate);
          return (
            <div key={p.id} className={`bg-white dark:bg-gray-800 rounded-xl border-2 p-3 ${
              claimExpiry?.expired || bidDeadline?.expired ? 'border-red-400 dark:border-red-600' :
              claimExpiry?.urgent || bidDeadline?.urgent ? 'border-orange-400 dark:border-orange-600' :
              'border-blue-200 dark:border-blue-700'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs font-mono text-gray-400">{p.eName}</div>
                  <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-tight">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.city}, {p.state}</div>
                </div>
                <button onClick={() => onOpenDetail(p.id)} className="text-xs text-gray-400 hover:text-orange-500 transition-colors flex-shrink-0">↗</button>
              </div>

              {/* Deadlines */}
              <div className="space-y-1 mb-3">
                {claimExpiry && (
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${claimExpiry.expired?'text-red-500':claimExpiry.urgent?'text-orange-500':'text-gray-500'}`}>
                    <span>⏱</span><span>Claim expires: {claimExpiry.text}</span>
                    {claimExpiry.expired && <span className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-xs font-bold">EXPIRED</span>}
                  </div>
                )}
                {bidDeadline && (
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${bidDeadline.expired?'text-red-500':bidDeadline.urgent?'text-orange-500':'text-gray-500'}`}>
                    <span>📅</span><span>Bid due: {fmtDate(p.bidDate)} ({bidDeadline.text})</span>
                  </div>
                )}
                {p.ssiPrice > 0 && <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{fmt(p.ssiPrice)}</div>}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={() => onSubmit(p)}
                  className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                  Submit for Review
                </button>
                <button onClick={() => onRelease(p)}
                  className="px-2.5 py-1.5 border border-red-300 dark:border-red-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium rounded-lg transition-colors">
                  Release
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Board Card ─────────────────────────────────────────────
function BoardCard({ project, staff, currentStaff, isManager, onClaim, onRelease, onMoveStage, onOpenDetail, onViewLog }) {
  const days = daysUntil(project.bidDate);
  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days >= 0 && days <= 3;
  const isMyClaim = project.claimedById === currentStaff?.id;
  const claimedByName = staff.find(s => s.id === project.claimedById)?.name;
  const claimExpiry = daysUntilLabel(project.claimDueDate);

  return (
    <div
      draggable={isManager}
      onDragStart={e => e.dataTransfer.setData('projectId', project.id)}
      className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-all cursor-pointer select-none hover:shadow-md hover:-translate-y-0.5
        ${claimExpiry?.expired ? 'border-red-400 dark:border-red-600' :
          isOverdue ? 'border-red-300 dark:border-red-700' :
          isUrgent ? 'border-orange-300 dark:border-orange-600' :
          isMyClaim ? 'border-blue-400 dark:border-blue-500' :
          'border-gray-200 dark:border-gray-700'}`}>

      <div onClick={() => onOpenDetail(project.id)} className="p-3">
        <div className="flex items-start justify-between gap-1 mb-1">
          <span className="text-xs font-mono text-gray-400">{project.eName||'—'}</span>
          <div className="flex items-center gap-1">
            {project.intakeSources?.includes('VIP') && <span className="text-amber-400 text-xs">⭐</span>}
            {project.timesReleased > 0 && (
              <button onClick={e=>{e.stopPropagation();onViewLog(project);}}
                className="text-xs text-amber-500 hover:text-amber-400 font-bold border border-amber-300 dark:border-amber-700 rounded px-1">
                ↩{project.timesReleased}
              </button>
            )}
          </div>
        </div>
        <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 leading-tight line-clamp-2 mb-1">{project.name}</div>
        <div className="text-xs text-gray-500">{project.city}, {project.state}</div>
        {project.bidDate && (
          <div className={`text-xs font-medium mt-1 ${isOverdue?'text-red-500':isUrgent?'text-orange-500':'text-gray-400'}`}>
            📅 {fmtDate(project.bidDate)}{days!==null&&<span className="ml-1 opacity-75">({days<0?`${Math.abs(days)}d ago`:days===0?'Today':`${days}d`})</span>}
          </div>
        )}
        {project.ssiPrice>0 && <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-0.5">{fmt(project.ssiPrice)}</div>}
        {project.estimator && <div className="text-xs text-gray-400 mt-0.5">Est: {project.estimator}</div>}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {project.companies?.slice(0,2).map((c,i)=>(
            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded px-1.5 py-0.5">{c.name}</span>
          ))}
          {project.companies?.length>2&&<span className="text-xs text-gray-400">+{project.companies.length-2}</span>}
        </div>
      </div>

      {/* WIP claim expiry warning */}
      {project.stage==='WIP' && project.claimDueDate && claimExpiry && (
        <div className={`px-3 pb-1 flex items-center gap-1.5 text-xs font-medium ${claimExpiry.expired?'text-red-500':claimExpiry.urgent?'text-orange-500':'text-gray-400'}`}>
          <span>⏱</span>
          <span>{claimExpiry.expired?'EXPIRED':'Expires'}: {claimExpiry.text}</span>
        </div>
      )}

      {/* Claim / Release controls */}
      {(project.stage==='Open Queue'||project.stage==='WIP') && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
          {project.claimedById ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isMyClaim?'bg-blue-600':'bg-gray-400'}`}>
                  {claimedByName?.[0]||'?'}
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{claimedByName}</div>
                  {isMyClaim && <div className="text-xs text-blue-500">You</div>}
                </div>
              </div>
              {(isMyClaim||isManager) && (
                <button onClick={e=>{e.stopPropagation();onRelease(project);}}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-200 dark:border-red-800 hover:border-red-400 px-2 py-1 rounded-lg transition-colors">
                  Release
                </button>
              )}
            </div>
          ) : (
            <button onClick={e=>{e.stopPropagation();onClaim(project);}}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
              Claim Bid
            </button>
          )}
        </div>
      )}

      {/* Go/No-Go for Projects in Review */}
      {project.stage==='Projects in Review' && isManager && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2 flex gap-2">
          <button onClick={e=>{e.stopPropagation();onMoveStage(project.id,'Open Queue');}}
            className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors">
            ✓ Pursue
          </button>
          <button onClick={e=>{e.stopPropagation();onMoveStage(project.id,'No Bid / Cancelled');}}
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
  const total = projects.reduce((a,p)=>a+(p.ssiPrice||0),0);

  return (
    <div className={`flex flex-col min-w-[240px] w-60 flex-shrink-0 rounded-xl transition-all ${dragOver?'ring-2 ring-orange-400 ring-offset-2':''}`}
      onDragOver={e=>{if(isManager){e.preventDefault();setDragOver(true);}}}
      onDragLeave={()=>setDragOver(false)}
      onDrop={e=>{
        e.preventDefault();setDragOver(false);
        if(!isManager)return;
        const id=e.dataTransfer.getData('projectId');
        if(id)onMoveStage(id,stage.id);
      }}>
      <div className={`${stage.light} ${stage.border} border rounded-t-xl px-3 py-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stage.color}`}/>
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">{stage.label}</span>
            <span className="text-xs text-gray-400">({projects.length})</span>
          </div>
          {total>0&&<span className="text-xs font-semibold text-gray-500">{fmt(total)}</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{stage.desc}</p>
      </div>
      <div className={`${stage.light} ${stage.border} border border-t-0 rounded-b-xl flex-1 p-2 space-y-2 min-h-[100px]`}>
        {projects.map(p=>(
          <BoardCard key={p.id} project={p} staff={staff} currentStaff={currentStaff} isManager={isManager}
            onClaim={onClaim} onRelease={onRelease} onMoveStage={onMoveStage}
            onOpenDetail={onOpenDetail} onViewLog={onViewLog}/>
        ))}
        {projects.length===0&&(
          <div className="text-xs text-gray-300 dark:text-gray-600 text-center py-6 italic">
            {dragOver?'Drop here':'Empty'}
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

  // Check for expired claims on load
  useEffect(() => {
    const expired = projects.filter(p =>
      p.stage==='WIP' && p.claimDueDate && daysUntil(p.claimDueDate) < 0
    );
    expired.forEach(async p => {
      await supabase.from('claim_log').insert({
        project_id: p.id, staff_id: p.claimedById,
        action: 'expired', reason: 'Claim expired after 2 business days',
      });
      await actions.update(p.id, {
        claimed_by: null, stage: 'Open Queue',
        times_released: (p.timesReleased || 0) + 1,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myBids = useMemo(() =>
    projects.filter(p => p.claimedById === currentStaff?.id && p.stage === 'WIP'),
  [projects, currentStaff]);

  const filtered = useMemo(() => {
    if (!filter) return projects;
    const q = filter.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.eName||'').toLowerCase().includes(q) ||
      p.estimator?.toLowerCase().includes(q)
    );
  }, [projects, filter]);

  const handleClaim = async (project) => {
    if (!currentStaff?.id) { alert('Your account is not linked to a staff record.'); return; }
    const claimDue = addBusinessDays(new Date(), 2);
    await supabase.from('claim_log').insert({
      project_id: project.id, staff_id: currentStaff.id, action: 'claimed',
    });
    await actions.update(project.id, {
      claimed_by: currentStaff.id, estimator_id: currentStaff.id,
      stage: 'WIP', claim_due_date: claimDue,
    });
  };

  const handleRelease = async (project, reason) => {
    if (!currentStaff?.id) return;
    const newCount = (project.timesReleased || 0) + 1;
    await supabase.from('claim_log').insert({
      project_id: project.id, staff_id: currentStaff.id,
      action: 'released', reason: reason || null,
    });
    if (newCount >= 2) {
      await supabase.from('claim_log').insert({
        project_id: project.id, staff_id: currentStaff.id,
        action: 'escalated', reason: `Auto-escalated after ${newCount} releases — needs manager review`,
      });
    }
    await actions.update(project.id, {
      claimed_by: null, stage: 'Open Queue',
      times_released: newCount, claim_due_date: null,
    });
  };

  const handleSubmit = async (project) => {
    if (!currentStaff?.id) return;
    await supabase.from('claim_log').insert({
      project_id: project.id, staff_id: currentStaff.id, action: 'submitted',
      reason: 'Submitted for senior estimator review',
    });
    await actions.update(project.id, {
      claimed_by: null, stage: 'Sent', claim_due_date: null,
    });
  };

  return (
    <div className="space-y-4">
      {/* My Bids banner — only shows if you have claimed bids */}
      <MyBidsBanner
        myBids={myBids}
        onOpenDetail={onOpenDetail}
        onRelease={p => setReleaseProject(p)}
        onSubmit={handleSubmit}
      />

      {/* Board header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">Bid Board</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {isManager
              ? 'Drag cards between columns · Estimators claim from Open Queue'
              : 'Claim bids from Open Queue · You have 2 business days to submit'}
          </p>
        </div>
        <input value={filter} onChange={e=>setFilter(e.target.value)}
          placeholder="Filter…"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 w-48"/>
      </div>

      {/* Columns */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD_STAGES.map(stage=>(
          <BoardColumn key={stage.id} stage={stage}
            projects={filtered.filter(p=>p.stage===stage.id)}
            staff={staff} currentStaff={currentStaff} isManager={isManager}
            onClaim={handleClaim} onRelease={p=>setReleaseProject(p)}
            onMoveStage={(id,s)=>actions.updateStage(id,s)}
            onOpenDetail={onOpenDetail} onViewLog={p=>setLogProject(p)}/>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-blue-500 inline-block"/><span>Your claim</span></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-400 inline-block"/><span>Bid due soon</span></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-red-400 inline-block"/><span>Overdue / expired</span></span>
        <span className="flex items-center gap-1.5"><span className="text-amber-400">⭐</span><span>VIP</span></span>
        <span className="flex items-center gap-1.5 text-amber-500 font-medium">↩2 = released twice, needs attention</span>
        {isManager && <span className="ml-auto flex items-center gap-1.5">⟺ Drag to move stage</span>}
      </div>

      {releaseProject && <ReleaseModal project={releaseProject} onRelease={handleRelease} onClose={()=>setReleaseProject(null)}/>}
      {logProject && <ClaimLogModal project={logProject} onClose={()=>setLogProject(null)}/>}
    </div>
  );
}
