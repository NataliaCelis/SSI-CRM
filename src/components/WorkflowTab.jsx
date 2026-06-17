import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

const WORKFLOW_STAGES = [
  {
    id: 'intake', label: 'Intake', color: 'bg-gray-500', lightBg: 'bg-gray-50 dark:bg-gray-800/40', border: 'border-gray-300 dark:border-gray-600',
    owner: 'Jack', desc: 'New bid opportunity received. Jack reviews against SSI criteria and decides if it belongs in the pipeline.',
    actions: ['Add to pipeline','Mark No Bid'],
    sla: '1 business day',
  },
  {
    id: 'gonogo', label: 'Go / No-Go', color: 'bg-orange-500', lightBg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800',
    owner: 'Senior Estimator', desc: 'Senior estimator reviews the opportunity and decides whether SSI should pursue it. Has a built-in deadline — if no decision in 2 days it escalates.',
    actions: ['Approve → Open Queue','Decline → No Bid'],
    sla: '2 business days',
  },
  {
    id: 'queue', label: 'Open Queue', color: 'bg-blue-500', lightBg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800',
    owner: 'Any Estimator', desc: 'Bid is available for any estimator to self-claim based on their availability. First to claim it owns it. If unclaimed after 1 business day, auto-escalates to Senior Estimator for manual assignment.',
    actions: ['Claim → In Progress'],
    sla: '1 business day to claim',
  },
  {
    id: 'inprogress', label: 'In Progress', color: 'bg-blue-600', lightBg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800',
    owner: 'Assigned Estimator', desc: 'Estimator is actively working the bid. They can unclaim if unavailable — bid returns to Open Queue with a logged reason. If a bid gets released more than twice, it auto-escalates to Senior Estimator.',
    actions: ['Submit for Review','Unclaim → Open Queue'],
    sla: 'Due date set at claim',
  },
  {
    id: 'sereview', label: 'Senior Estimator Review', color: 'bg-purple-500', lightBg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800',
    owner: 'Senior Estimator', desc: 'Senior estimator reviews the completed bid for accuracy and competitiveness. For bids above your threshold or flagged as high-risk (military/federal), this triggers a CEO review. For standard bids, it goes straight to Jack to send.',
    actions: ['Approve standard → Ready to Send','Flag large/high-risk → CEO Review','Send back → In Progress'],
    sla: '1 business day',
  },
  {
    id: 'ceoreview', label: 'CEO Review', color: 'bg-amber-500', lightBg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800',
    owner: 'CEO', desc: 'Only triggered for large bids or high-risk projects. CEO approves or requests revisions. Revisions go directly back to the estimator — skipping the Senior Estimator hop — to cut one loop out of the chain.',
    actions: ['Approve → Ready to Send','Revisions → In Progress (same estimator)'],
    sla: '1 business day',
    conditional: true,
  },
  {
    id: 'sent', label: 'Sent to Client', color: 'bg-green-500', lightBg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800',
    owner: 'Jack', desc: 'Jack sends the final bid to the client. Project moves to Sent stage in the pipeline. From here it awaits award or loss.',
    actions: ['Mark Sent → awaiting award'],
    sla: 'Same day as approval',
  },
];

const CLAIM_LOG_EXAMPLE = [
  { estimator:'Lee', action:'Claimed', ts:'Jun 3, 9:02 AM', reason:'' },
  { estimator:'Lee', action:'Released', ts:'Jun 3, 2:14 PM', reason:'Out of bandwidth — traveling this week' },
  { estimator:'Mike', action:'Claimed', ts:'Jun 3, 2:31 PM', reason:'' },
  { estimator:'Mike', action:'Released', ts:'Jun 4, 8:45 AM', reason:'Missing specs from GC' },
  { estimator:'Clint', action:'Claimed', ts:'Jun 4, 9:10 AM', reason:'' },
];

const ESTIMATOR_STATS = [
  { name:'Lee', completed:14, released:2, rate:'87%', avg:'3.2d' },
  { name:'Mike', completed:11, released:4, rate:'73%', avg:'4.1d' },
  { name:'Clint', completed:16, released:1, rate:'94%', avg:'2.8d' },
  { name:'Leo', completed:9, released:3, rate:'75%', avg:'3.9d' },
];

export default function WorkflowTab({ projects = [], staff = [] }) {
  const { isManager } = useAuth();
  const [activeStage, setActiveStage] = useState(null);
  const [activeTab, setActiveTab] = useState('flow');

  // Count projects in each pipeline stage
  const stageCounts = {
    'Projects in Review': projects.filter(p=>p.stage==='Projects in Review').length,
    'WIP': projects.filter(p=>p.stage==='WIP').length,
    'Sent': projects.filter(p=>p.stage==='Sent').length,
    'Awarded': projects.filter(p=>p.stage==='Awarded').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bid Workflow</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              A single source of truth replacing email chains and competing spreadsheets. Every stage has an owner and a deadline — stalls become visible before deadlines are missed.
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {['flow','claims','reporting'].map(t=>(
              <button key={t} onClick={()=>setActiveTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${activeTab===t?'bg-orange-500 text-white':'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {t === 'flow' ? '⟶ Flow' : t === 'claims' ? '📋 Claim Log' : '📊 Reporting'}
              </button>
            ))}
          </div>
        </div>

        {/* Live pipeline counts */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {Object.entries(stageCounts).map(([stage,count])=>(
            <div key={stage} className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{stage}:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                stage==='Projects in Review'?'bg-orange-500':stage==='WIP'?'bg-blue-500':stage==='Sent'?'bg-green-500':'bg-purple-500'
              }`}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flow tab */}
      {activeTab==='flow' && (
        <div>
          {/* Flow diagram */}
          <div className="flex items-start gap-2 overflow-x-auto pb-4">
            {WORKFLOW_STAGES.map((stage, i) => (
              <div key={stage.id} className="flex items-start flex-shrink-0">
                <button onClick={()=>setActiveStage(activeStage===stage.id ? null : stage.id)}
                  className={`w-36 rounded-xl border-2 p-3 text-left transition-all ${
                    activeStage===stage.id
                      ? `${stage.lightBg} ${stage.border} shadow-md scale-105`
                      : `bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600`
                  }`}>
                  <div className={`w-7 h-7 rounded-lg ${stage.color} flex items-center justify-center text-white text-xs font-bold mb-2`}>
                    {i+1}
                  </div>
                  <div className="font-semibold text-xs text-gray-800 dark:text-gray-100 leading-tight">{stage.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{stage.owner}</div>
                  {stage.conditional && (
                    <div className="text-xs text-amber-500 mt-1 font-medium">Conditional</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1 font-medium">SLA: {stage.sla}</div>
                </button>
                {i < WORKFLOW_STAGES.length-1 && (
                  <div className="flex items-center self-center px-1 text-gray-300 dark:text-gray-600 text-xl mt-2">›</div>
                )}
              </div>
            ))}
          </div>

          {/* Stage detail */}
          {activeStage && (()=>{
            const s = WORKFLOW_STAGES.find(x=>x.id===activeStage);
            return (
              <div className={`rounded-2xl border-2 ${s.border} ${s.lightBg} p-5`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${s.color}`}>{s.label}</span>
                      {s.conditional && <span className="px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-medium">Conditional</span>}
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 max-w-xl">{s.desc}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Actions</div>
                    <div className="space-y-1">
                      {s.actions.map((a,i)=>(
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${s.color}`}/>
                          {a}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-gray-400">
                      <span className="font-semibold">SLA:</span> {s.sla}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Key rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {[
              { icon:'🙋', title:'Self-Claim', desc:'Estimators claim bids from the Open Queue based on their own availability. First to claim owns it — no waiting on assignment from above.' },
              { icon:'↩', title:'Unclaim & Log', desc:'Estimators can release a bid back to the queue with an optional reason. Every claim and release is timestamped and logged for visibility.' },
              { icon:'⚠', title:'Auto-Escalation', desc:'Bids unclaimed for 1+ business day, or released 2+ times, auto-escalate to the Senior Estimator for manual assignment.' },
              { icon:'💰', title:'Conditional CEO Review', desc:'CEO review only triggers for large bids or flagged project types (e.g. military, federal). Standard bids skip this step entirely.' },
              { icon:'⟳', title:'Direct Revisions', desc:'CEO revision requests go directly back to the estimator — not back through the Senior Estimator — cutting one full hop out of the chain.' },
              { icon:'📅', title:'Stage Due Dates', desc:'Every stage sets a due date when a bid enters it. Overdue bids surface automatically so nothing gets buried in an inbox.' },
            ].map(({icon,title,desc})=>(
              <div key={title} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="text-2xl mb-2">{icon}</div>
                <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-1">{title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Claims tab */}
      {activeTab==='claims' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Claim Log — Example</h3>
            <p className="text-xs text-gray-400 mt-0.5">Every claim and release on a bid is logged with a timestamp. This example shows a bid that was released twice before being completed.</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {CLAIM_LOG_EXAMPLE.map((entry,i)=>(
              <div key={i} className="px-6 py-3 flex items-start gap-4">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${entry.action==='Claimed'?'bg-green-500':'bg-red-400'}`}/>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{entry.estimator}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.action==='Claimed'?'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400':'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>{entry.action}</span>
                    <span className="text-xs text-gray-400 ml-auto">{entry.ts}</span>
                  </div>
                  {entry.reason && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">"{entry.reason}"</div>}
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800">
            <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">⚠ Auto-escalated to Senior Estimator after 2 releases — Clint assigned manually</div>
          </div>
        </div>
      )}

      {/* Reporting tab */}
      {activeTab==='reporting' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Estimator Claim vs. Release Rate</h3>
              <p className="text-xs text-gray-400 mt-0.5">Pattern visibility — not real-time policing. High release rates signal bandwidth issues or project-fit mismatches worth a conversation.</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {ESTIMATOR_STATS.map(e=>(
                  <div key={e.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-sm text-gray-800 dark:text-gray-200 w-12">{e.name}</span>
                        <span className="text-xs text-gray-400">{e.completed} completed · {e.released} released · avg {e.avg}</span>
                      </div>
                      <span className={`text-sm font-bold ${parseFloat(e.rate)>=90?'text-green-500':parseFloat(e.rate)>=75?'text-yellow-500':'text-red-500'}`}>{e.rate}</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${parseFloat(e.rate)>=90?'bg-green-500':parseFloat(e.rate)>=75?'bg-yellow-500':'bg-red-400'}`}
                        style={{width:e.rate}}/>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4 italic">Note: These are example figures. Live data will populate once the claim/unclaim feature is built into the pipeline.</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Time in Stage (Example)</h3>
            <div className="space-y-2">
              {[
                {stage:'Go/No-Go',avg:'1.4d',max:'3.2d',color:'bg-orange-400'},
                {stage:'Open Queue',avg:'0.6d',max:'2.1d',color:'bg-blue-400'},
                {stage:'In Progress',avg:'4.2d',max:'9.8d',color:'bg-blue-600'},
                {stage:'SE Review',avg:'0.9d',max:'1.8d',color:'bg-purple-400'},
                {stage:'CEO Review',avg:'0.7d',max:'1.2d',color:'bg-amber-400'},
              ].map(s=>(
                <div key={s.stage} className="flex items-center gap-3 text-xs">
                  <span className="w-32 text-gray-600 dark:text-gray-400">{s.stage}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full`} style={{width:`${(parseFloat(s.avg)/10)*100}%`}}/>
                  </div>
                  <span className="text-gray-500 w-16 text-right">avg {s.avg}</span>
                  <span className="text-gray-400 w-16 text-right">max {s.max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
