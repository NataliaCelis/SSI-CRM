import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { geocodeCityState } from '../lib/supabase';

const STAGES = ['Under Review','Sent','Pending Award','Won','Lost','No Bid / Cancelled'];
const STAGE_COLORS = {
  'Under Review':'bg-orange-500','Sent':'bg-green-500','Pending Award':'bg-purple-500',
  'Won':'bg-yellow-500','Lost':'bg-red-500','No Bid / Cancelled':'bg-gray-500',
};
const TYPES = ['GROUND UP','RENO/EXP','ADD','BUDGET','MERGER','DESIGN/BUILD','EXPANSION','RENO','ADD/RENO','SUB FAB','DEMO/RENO','REMODEL'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const fmt = n => (n != null && n !== '' && Number(n) !== 0) ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
const ic = 'w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 text-gray-800 dark:text-gray-200';
const lbl = 'text-xs text-gray-500 dark:text-gray-400 mb-1 block';

// ── Overview Tab ───────────────────────────────────────────
function OverviewTab({ project, onSave, onDelete, currentStaff, isManager }) {
  const [draft, setDraft] = useState({ ...project });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => { setDraft({ ...project }); }, [project.id]);

  const set = (field, val) => setDraft(d => ({ ...d, [field]: val }));

  // Auto-geocode when city+state are both present
  useEffect(() => {
    if (!draft.city || !draft.state || draft.city.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const result = await geocodeCityState(draft.city, draft.state);
        if (cancelled || !result) return;
        setDraft(d => ({
          ...d,
          distance: `${result.distanceMiles} Miles`,
          distance_miles: result.distanceMiles,
          // Only fill zip if user hasn't already entered one
          zip: d.zip || result.zip || '',
        }));
      } finally {
        if (!cancelled) setGeocoding(false);
      }
    }, 800); // debounce — wait for user to stop typing
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.city, draft.state]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(project.id, {
        project_name: draft.name,
        project_type: draft.type,
        city: draft.city,
        state: draft.state,
        bid_date: draft.bidDate || null,
        addenda: Number(draft.addenda) || 0,
        tonnage: Number(draft.tonnage) || null,
        ssi_price: Number(draft.ssiPrice) || 0,
        fab_cost: Number(draft.fabCost) || null,
        erect_cost: Number(draft.erectCost) || null,
        sales_tax: draft.salesTax,
        prevailing_wages: draft.prevWages,
        distance_miles: draft.distance_miles || null,
        follow_up_date: draft.followUpDate || null,
        prequal: draft.prequal,
        e_number: draft.eName,
        _award: {
          awarded_gc_contact_name: draft.awardedGCContact,
          awarded_gc_phone: draft.awardedGCPhone,
          awarded_gc_email: draft.awardedGCEmail,
          steel_sub: draft.awardedSub,
          awarded_price: Number(draft.awardedPrice) || null,
          award_notes: draft.awardNotes,
          our_tonnage: Number(draft.ourTonnage) || null,
          winning_sub_tonnage: Number(draft.winnerTonnage) || null,
          winning_sub_price: Number(draft.winnerPrice) || null,
        },
        _awardedGC: draft.awardedGC,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  const isLost = draft.stage === 'Lost' || project.stage === 'Lost';

  // Correct lost bid math:
  // ourPrice = what we bid (awardedPrice = what was awarded to the GC, our SSI price is ssiPrice)
  // winnerPrice = what the winning steel sub bid
  // diff > 0 means we were MORE expensive (over), diff < 0 means we were cheaper (under)
  const ourBidPrice = Number(draft.ssiPrice) || 0;
  const winnerPrice = Number(draft.winnerPrice) || 0;
  const awardedPrice = Number(draft.awardedPrice) || 0;
  const diff = ourBidPrice - winnerPrice;
  const pct = winnerPrice > 0 ? Math.abs((diff / winnerPrice) * 100).toFixed(1) : null;
  const ourTon = Number(draft.ourTonnage) || 0;
  const winTon = Number(draft.winnerTonnage) || 0;
  const tonDiff = ourTon - winTon;

  return (
    <div className="space-y-5 py-4">
      {/* Project Info */}
      <section>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Project Info</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={lbl}>Project Name</label>
            <input value={draft.name||''} onChange={e=>set('name',e.target.value)} className={ic} placeholder="Project name" />
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select value={draft.type||''} onChange={e=>set('type',e.target.value)} className={ic}>
              {TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>E#</label>
            <input value={draft.eName||''} onChange={e=>set('eName',e.target.value)} className={ic} placeholder="E26-001" />
          </div>
          <div>
            <label className={lbl}>City</label>
            <input value={draft.city||''} onChange={e=>set('city',e.target.value)} className={ic} placeholder="City" />
          </div>
          <div>
            <label className={lbl}>State</label>
            <select value={draft.state||''} onChange={e=>set('state',e.target.value)} className={ic}>
              <option value="">— Select State —</option>
              {US_STATES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>
              Zip Code
              {geocoding && <span className="ml-1 text-orange-400 font-normal animate-pulse">Looking up…</span>}
              {!geocoding && draft.zip && <span className="ml-1 text-green-500 font-normal text-xs">✓</span>}
            </label>
            <input value={draft.zip||''} onChange={e=>set('zip',e.target.value)} className={ic} placeholder="Auto-filled from city/state" />
          </div>
          <div>
            <label className={lbl}>
              Distance from Chattanooga, TN
              {geocoding && <span className="ml-1 text-orange-400 font-normal animate-pulse">Calculating…</span>}
            </label>
            <input value={draft.distance||''} onChange={e=>set('distance',e.target.value)} className={ic}
              placeholder={draft.city && draft.state ? (geocoding ? 'Looking up…' : 'Enter city & state, auto-calculates') : 'Enter city & state first'} />
          </div>
          <div>
            <label className={lbl}>Bid Date</label>
            <input type="date" value={draft.bidDate||''} onChange={e=>set('bidDate',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Addenda</label>
            <input type="number" value={draft.addenda||''} onChange={e=>set('addenda',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Tonnage</label>
            <input type="number" value={draft.tonnage||''} onChange={e=>set('tonnage',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>SSI Price ($)</label>
            <input type="number" value={draft.ssiPrice||''} onChange={e=>set('ssiPrice',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>FAB Cost ($)</label>
            <input type="number" value={draft.fabCost||''} onChange={e=>set('fabCost',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Erect Cost ($)</label>
            <input type="number" value={draft.erectCost||''} onChange={e=>set('erectCost',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Sales Tax</label>
            <input value={draft.salesTax||''} onChange={e=>set('salesTax',e.target.value)} className={ic} placeholder="e.g. YES / 4.5%" />
          </div>
          <div>
            <label className={lbl}>Prevailing Wages</label>
            <input value={draft.prevWages||''} onChange={e=>set('prevWages',e.target.value)} className={ic} placeholder="e.g. DB / N/A" />
          </div>
          <div>
            <label className={lbl}>Follow-Up Date</label>
            <input type="date" value={draft.followUpDate||''} onChange={e=>set('followUpDate',e.target.value)} className={ic} />
          </div>
          <div className="col-span-2">
            <label className={lbl}>Pre-Qual Notes</label>
            <textarea value={draft.prequal||''} onChange={e=>set('prequal',e.target.value)} rows={2} className={ic+' resize-none'} />
          </div>
        </div>
      </section>

      {/* Award Info */}
      <section className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Award Info</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Awarded GC</label>
            <input value={draft.awardedGC||''} onChange={e=>set('awardedGC',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Steel Sub (winner)</label>
            <input value={draft.awardedSub||''} onChange={e=>set('awardedSub',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Awarded Price ($) {project.stage==='Lost'&&<span className="text-red-400">(shown in red on table)</span>}</label>
            <input type="number" value={draft.awardedPrice||''} onChange={e=>set('awardedPrice',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Awarded GC Contact</label>
            <input value={draft.awardedGCContact||''} onChange={e=>set('awardedGCContact',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Awarded GC Phone</label>
            <input value={draft.awardedGCPhone||''} onChange={e=>set('awardedGCPhone',e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lbl}>Awarded GC Email</label>
            <div className="flex gap-2 items-center">
              <input type="email" value={draft.awardedGCEmail||''} onChange={e=>set('awardedGCEmail',e.target.value)} className={ic+' flex-1'} />
              {draft.awardedGCEmail&&<a href={`mailto:${draft.awardedGCEmail}`} className="text-orange-500 text-xs hover:underline whitespace-nowrap flex-shrink-0">✉ Open</a>}
            </div>
          </div>
          <div className="col-span-2">
            <label className={lbl}>Award Notes</label>
            <textarea value={draft.awardNotes||''} onChange={e=>set('awardNotes',e.target.value)} rows={2} className={ic+' resize-none'} />
          </div>
        </div>
      </section>

      {/* Lost Bid Comparison — only when stage is Lost */}
      {isLost && (
        <section className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">Lost Bid Comparison</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Our Tonnage</label>
              <input type="number" value={draft.ourTonnage||''} onChange={e=>set('ourTonnage',e.target.value)} className={ic} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Winning Sub Tonnage</label>
              <input type="number" value={draft.winnerTonnage||''} onChange={e=>set('winnerTonnage',e.target.value)} className={ic} placeholder="0" />
            </div>
            <div>
              <label className={lbl}>Our Price (SSI Price above)</label>
              <div className={`${ic} bg-gray-50 dark:bg-gray-800 cursor-default font-semibold`}>
                {ourBidPrice > 0 ? '$' + ourBidPrice.toLocaleString() : <span className="text-gray-400 font-normal">Enter SSI Price above</span>}
              </div>
            </div>
            <div>
              <label className={lbl}>Winning Sub Price ($)</label>
              <input type="number" value={draft.winnerPrice||''} onChange={e=>set('winnerPrice',e.target.value)} className={ic} placeholder="0" />
            </div>
          </div>

          {/* Result callout */}
          {ourBidPrice > 0 && winnerPrice > 0 ? (
            <div className={`mt-3 p-3 rounded-lg text-sm font-semibold ${diff > 0 ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'}`}>
              We were {fmt(Math.abs(diff))} ({pct}%) {diff > 0 ? 'OVER' : 'UNDER'} the winner
              {ourTon > 0 && winTon > 0 && (
                <span className="ml-3 font-normal text-xs opacity-75">
                  | Tonnage: {Math.abs(tonDiff)} tons {tonDiff > 0 ? 'more' : 'fewer'} than winner
                </span>
              )}
            </div>
          ) : (
            <div className="mt-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs">
              Enter both <strong>SSI Price</strong> (above) and <strong>Winning Sub Price</strong> to see the comparison.
            </div>
          )}
        </section>
      )}

      {/* Save / Delete */}
      <div className="flex items-center gap-3 pt-1 pb-4 flex-wrap">
        <button onClick={save} disabled={saving}
          className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors shadow shadow-orange-500/20">
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save All Changes'}
        </button>
        {isManager && !confirmDel && (
          <button onClick={()=>setConfirmDel(true)} className="ml-auto px-4 py-2 text-sm text-red-500 hover:text-red-400 border border-red-300 dark:border-red-800 rounded-lg transition-colors">
            Delete Project
          </button>
        )}
        {isManager && confirmDel && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-red-500">Confirm? A backup will be saved.</span>
            <button onClick={()=>setConfirmDel(false)} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
            <button onClick={()=>onDelete(project.id, currentStaff?.id)} className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold">Yes, Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Companies Tab ──────────────────────────────────────────
function CompaniesTab({ project, onSaveCompanies }) {
  const [editing, setEditing] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ setCompanies(JSON.parse(JSON.stringify(project.companies||[]))); },[project.id, project.companies?.length]);

  const nc = ()=>({name:'',email:'',officePhone:'',ext:'',cell:''});
  const ng = ()=>({name:'',contacts:[nc()]});
  const updGC = (gi,f,v)=>setCompanies(cs=>cs.map((c,i)=>i===gi?{...c,[f]:v}:c));
  const updCt = (gi,ci,f,v)=>setCompanies(cs=>cs.map((c,i)=>i===gi?{...c,contacts:c.contacts.map((ct,j)=>j===ci?{...ct,[f]:v}:ct)}:c));
  const rmGC = gi=>setCompanies(cs=>cs.filter((_,i)=>i!==gi));
  const rmCt = (gi,ci)=>setCompanies(cs=>cs.map((c,i)=>i===gi?{...c,contacts:c.contacts.filter((_,j)=>j!==ci)}:c));

  const save = async()=>{
    setSaving(true);
    try{ await onSaveCompanies(project.id,companies); setEditing(false); }
    finally{ setSaving(false); }
  };

  if(!editing) return(
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">GCs & Contacts</div>
        <button onClick={()=>setEditing(true)} className="text-xs text-orange-500 hover:text-orange-400 transition-colors">✏ Edit GCs</button>
      </div>
      {companies.length===0&&<p className="text-sm text-gray-400 italic">No companies added yet.</p>}
      {companies.map((gc,i)=>(
        <div key={i} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="font-semibold text-gray-900 dark:text-white mb-3">{gc.name}</div>
          {gc.contacts?.map((c,j)=>(
            <div key={j} className="space-y-0.5 border-t border-gray-200 dark:border-gray-700/50 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
              <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{c.name}</div>
              {c.email&&<a href={`mailto:${c.email}`} className="text-orange-500 hover:underline text-xs block">✉ {c.email}</a>}
              {c.officePhone&&<div className="text-gray-500 dark:text-gray-400 text-xs">📞 {c.officePhone}{c.ext?` x${c.ext}`:''}</div>}
              {c.cell&&<div className="text-gray-500 dark:text-gray-400 text-xs">📱 {c.cell}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return(
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Edit GCs & Contacts</div>
        <button onClick={()=>{setEditing(false);setCompanies(JSON.parse(JSON.stringify(project.companies||[])));}} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      {companies.map((gc,gi)=>(
        <div key={gi} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex gap-2 mb-3">
            <input value={gc.name} onChange={e=>updGC(gi,'name',e.target.value)} className={ic+' flex-1 font-medium'} placeholder="GC Name" />
            <button onClick={()=>rmGC(gi)} className="text-red-400 hover:text-red-300 text-xl leading-none">×</button>
          </div>
          {gc.contacts?.map((c,ci)=>(
            <div key={ci} className="grid grid-cols-2 gap-2 border-t border-gray-200 dark:border-gray-700/50 pt-3 mt-3 relative">
              {gc.contacts.length>1&&<button onClick={()=>rmCt(gi,ci)} className="absolute right-0 top-3 text-red-400 hover:text-red-300 text-sm">×</button>}
              <div className="col-span-2"><input value={c.name} onChange={e=>updCt(gi,ci,'name',e.target.value)} className={ic} placeholder="Contact Name" /></div>
              <input value={c.email} onChange={e=>updCt(gi,ci,'email',e.target.value)} className={ic} placeholder="Email" />
              <div className="flex gap-1">
                <input value={c.officePhone} onChange={e=>updCt(gi,ci,'officePhone',e.target.value)} className={ic+' flex-1'} placeholder="Office Phone" />
                <input value={c.ext} onChange={e=>updCt(gi,ci,'ext',e.target.value)} className="w-14 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Ext" />
              </div>
              <input value={c.cell} onChange={e=>updCt(gi,ci,'cell',e.target.value)} className={ic} placeholder="Cell Phone" />
            </div>
          ))}
          <button onClick={()=>setCompanies(cs=>cs.map((c,i)=>i===gi?{...c,contacts:[...c.contacts,nc()]}:c))} className="text-xs text-gray-400 hover:text-orange-500 mt-2 transition-colors">+ Add Contact</button>
        </div>
      ))}
      <button onClick={()=>setCompanies(cs=>[...cs,ng()])} className="text-sm text-orange-500 hover:text-orange-400 transition-colors">+ Add GC</button>
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors">
          {saving?'Saving…':'Save GCs'}
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
  const [err, setErr] = useState('');

  const submit = async()=>{
    if(!text.trim()) return;
    if(!currentStaff?.id){ setErr('Your account is not linked to a staff record. Ask a Manager.'); return; }
    setSaving(true); setErr('');
    try{ await onAddNote(project.id,currentStaff.id,role,text.trim()); setText(''); }
    catch(e){ setErr(e.message); }
    finally{ setSaving(false); }
  };

  return(
    <div className="py-4 flex flex-col gap-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Add a note…" rows={3}
          className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder-gray-400 dark:placeholder-gray-600 text-gray-800 dark:text-gray-200" />
        {err&&<p className="text-xs text-red-500 mt-1">{err}</p>}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            {['Estimator','Sales'].map(r=>(
              <button key={r} onClick={()=>setRole(r)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${role===r?'bg-orange-500 border-orange-400 text-white':'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-orange-400'}`}>{r}</button>
            ))}
          </div>
          <button onClick={submit} disabled={saving||!text.trim()}
            className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-medium text-white transition-colors">
            {saving?'Adding…':'Add Note'}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {[...(project.notes||[])].reverse().map(n=>(
          <div key={n.id} className="flex gap-3 group">
            <div className={`w-1 rounded-full self-stretch flex-shrink-0 ${n.role==='Estimator'?'bg-blue-500':'bg-emerald-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-semibold ${n.role==='Estimator'?'text-blue-500':'text-emerald-500'}`}>{n.author}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${n.role==='Estimator'?'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400':'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>{n.role}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(n.ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                {/* Only the note author OR a manager can delete */}
                {(isManager || n.staffId === currentStaff?.id) && (
                  <button onClick={()=>onDeleteNote(project.id,n.id,currentStaff?.id)}
                    className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity" title="Delete note (backed up)">✕</button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{n.text}</p>
            </div>
          </div>
        ))}
        {!project.notes?.length&&<p className="text-sm text-gray-400 italic">No activity yet.</p>}
      </div>
    </div>
  );
}

// ── Tasks Tab ──────────────────────────────────────────────
function TasksTab({ project, staff, currentStaff, isManager, onAddTask, onUpdateTask, onDeleteTask, emailTemplate }) {
  const [form, setForm] = useState({title:'',description:'',assigneeId:'',dueDate:''});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const assign = async()=>{
    if(!form.title||!form.assigneeId){ setErr('Title and assignee are required.'); return; }
    if(!currentStaff?.id){ setErr('Your account is not linked to a staff record.'); return; }
    setSaving(true); setErr('');
    const assignee = staff.find(s=>s.id===form.assigneeId);
    try{
      await onAddTask(project.id,{
        title:form.title, description:form.description,
        assignee_id:form.assigneeId, assigned_by_id:currentStaff.id,
        due_date:form.dueDate||null,
      });
      const body=(emailTemplate||'Hi {assignee_name},\n\nTask: {task_title}\nProject: {project_name} ({e_number})\nDetails: {task_description}\nDue: {due_date}\n\n— {assigned_by}')
        .replace('{assignee_name}',assignee?.name||'')
        .replace('{project_name}',project.name)
        .replace('{e_number}',project.eName||'')
        .replace('{task_title}',form.title)
        .replace('{task_description}',form.description||'N/A')
        .replace('{due_date}',form.dueDate||'Not set')
        .replace('{assigned_by}',currentStaff.name||'');
      window.open(`mailto:${assignee?.email}?subject=${encodeURIComponent(`Task: ${form.title} — ${project.name}`)}&body=${encodeURIComponent(body)}`);
      setForm({title:'',description:'',assigneeId:'',dueDate:''});
    }catch(e){ setErr(e.message); }
    finally{ setSaving(false); }
  };

  return(
    <div className="py-4 space-y-4">
      {isManager&&(
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assign Task</div>
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Task title *" className={ic} />
          <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Description (optional)" rows={2} className={ic+' resize-none'} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Assignee *</label>
              <select value={form.assigneeId} onChange={e=>setForm(f=>({...f,assigneeId:e.target.value}))} className={ic}>
                <option value="">Select person…</option>
                {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} className={ic} />
            </div>
          </div>
          {err&&<p className="text-xs text-red-500">{err}</p>}
          <button onClick={assign} disabled={saving||!form.title||!form.assigneeId}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors">
            {saving?'Assigning…':'📧 Assign & Send Email'}
          </button>
        </div>
      )}
      <div className="space-y-2">
        {project.tasks?.map(t=>(
          <div key={t.id} className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-3 group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-800 dark:text-gray-200">{t.title}</div>
                {t.description&&<div className="text-xs text-gray-500 mt-0.5">{t.description}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Anyone can update status of tasks assigned to them; managers can update any */}
                {(isManager || t.assigneeId === currentStaff?.id) && (
                  <select value={t.status} onChange={e=>onUpdateTask(project.id,t.id,{status:e.target.value})}
                    className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none">
                    {['Open','In Progress','Done'].map(s=><option key={s}>{s}</option>)}
                  </select>
                )}
                {isManager&&(
                  <button onClick={()=>onDeleteTask(project.id,t.id,currentStaff?.id)}
                    className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity" title="Delete task (backed up)">×</button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              {t.assigneeEmail
                ?<a href={`mailto:${t.assigneeEmail}`} className="text-orange-500 hover:underline">✉ {t.assignee}</a>
                :<span>{t.assignee}</span>}
              {t.assignedBy&&<span className="text-gray-400">by {t.assignedBy}</span>}
              {t.dueDate&&<span>Due: {fmtDate(t.dueDate)}</span>}
              <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-medium ${
                t.status==='Done'?'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400':
                t.status==='In Progress'?'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400':
                'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>{t.status}</span>
            </div>
          </div>
        ))}
        {!project.tasks?.length&&<p className="text-sm text-gray-400 italic">No tasks yet.</p>}
      </div>
    </div>
  );
}

// ── Main ProjectDetail ─────────────────────────────────────
export default function ProjectDetail({ project, staff, onClose, onUpdate, onUpdateStage, onDelete, onAddNote, onDeleteNote, onAddTask, onUpdateTask, onDeleteTask, onSaveCompanies, emailTemplate }) {
  const { staff: currentStaff, isManager } = useAuth();
  const [tab, setTab] = useState('overview');
  if(!project) return null;
  const openTasks = project.tasks?.filter(t=>t.status!=='Done').length||0;

  return(
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <div className="text-xs text-gray-400 font-mono">{project.eName||'—'} · {project.type}</div>
              <h2 className="font-bold text-lg leading-tight text-gray-900 dark:text-white mt-0.5 truncate">{project.name}</h2>
              <div className="text-sm text-gray-500 mt-0.5">{project.city}, {project.state} · Bid {fmtDate(project.bidDate)}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none flex-shrink-0 transition-colors">×</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map(s=>{
              const active=project.stage===s;
              return(
                <button key={s} onClick={()=>isManager&&onUpdateStage(project.id,s)}
                  title={isManager?`Set to ${s}`:'Managers only'}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                    active?`${STAGE_COLORS[s]} text-white border-transparent ring-2 ring-orange-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900`
                    :isManager?'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-orange-400'
                    :'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 cursor-default'
                  }`}>
                  {!isManager&&active&&'🔒 '}{s}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex border-b border-gray-200 dark:border-gray-800 px-6 overflow-x-auto flex-shrink-0">
          {[
            {id:'overview',label:'Overview'},
            {id:'companies',label:'Companies'},
            {id:'activity',label:`Activity${project.notes?.length?` (${project.notes.length})`:''}`},
            {id:'tasks',label:`Tasks${openTasks?` (${openTasks})`:''}`},
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab===t.id?'border-orange-500 text-orange-500':'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-6">
          {tab==='overview'&&<OverviewTab project={project} onSave={onUpdate} onDelete={onDelete} currentStaff={currentStaff} isManager={isManager} />}
          {tab==='companies'&&<CompaniesTab project={project} onSaveCompanies={onSaveCompanies} />}
          {tab==='activity'&&<ActivityTab project={project} currentStaff={currentStaff} isManager={isManager} onAddNote={onAddNote} onDeleteNote={onDeleteNote} />}
          {tab==='tasks'&&<TasksTab project={project} staff={staff} currentStaff={currentStaff} isManager={isManager} onAddTask={onAddTask} onUpdateTask={onUpdateTask} onDeleteTask={onDeleteTask} emailTemplate={emailTemplate} />}
        </div>
      </div>
    </div>
  );
}
