import { useState, useEffect } from 'react';
import { useNextENumber } from '../hooks/useData';
import { geocodeCityState } from '../lib/supabase';

const STAGES = ['Projects in Review','Open Queue','WIP','Sent','GC Awarded','Won','Lost','No Bid / Cancelled'];
const TYPES = ['GROUND UP','RENO/EXP','ADD','BUDGET','MERGER','DESIGN/BUILD','EXPANSION','RENO','ADD/RENO','SUB FAB','DEMO/RENO','REMODEL'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const newContact = () => ({ name:'', email:'', officePhone:'', ext:'', cell:'' });
const newGC = () => ({ name:'', contacts:[newContact()] });

export default function AddProjectModal({ staff, allCompanies=[], onClose, onCreate }) {
  const autoENum = useNextENumber();
  const estimators = staff.filter(s => s.roles?.includes('Estimator'));
  const [form, setForm] = useState({
    eName:'', stage:'Projects in Review', name:'', type:'GROUND UP',
    estimatorId:'', city:'', state:'TN', bidDate:'', tonnage:'',
    ssiPrice:'', fabCost:'', erectCost:'', salesTax:'', prevWages:'',
    squareFeet:'', addenda:'', zip:'', distance:'', distance_miles:null,
    followUpDate:'', prequal:'',
    intakeSources:[], projectUrl:'', intakeNotes:'',
    companies:[newGC()],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => { if (autoENum) setForm(f=>({...f, eName:autoENum})); }, [autoENum]);

  // Auto geocode when city+state filled
  useEffect(() => {
    if (!form.city || !form.state || form.city.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setGeocoding(true);
      try {
        const result = await geocodeCityState(form.city, form.state);
        if (cancelled || !result) return;
        setForm(f => ({
          ...f,
          distance: `${result.distanceMiles} Miles`,
          distance_miles: result.distanceMiles,
          zip: f.zip || result.zip || '',
        }));
      } finally { if (!cancelled) setGeocoding(false); }
    }, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city, form.state]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const updGC = (gi,k,v) => setForm(f=>({...f,companies:f.companies.map((c,i)=>i===gi?{...c,[k]:v}:c)}));
  const updCt = (gi,ci,k,v) => setForm(f=>({...f,companies:f.companies.map((c,i)=>i===gi?{...c,contacts:c.contacts.map((ct,j)=>j===ci?{...ct,[k]:v}:ct)}:c)}));
  const addGC = () => setForm(f=>({...f,companies:[...f.companies,newGC()]}));
  const rmGC = gi => setForm(f=>({...f,companies:f.companies.filter((_,i)=>i!==gi)}));
  const addCt = gi => setForm(f=>({...f,companies:f.companies.map((c,i)=>i===gi?{...c,contacts:[...c.contacts,newContact()]}:c)}));
  const rmCt = (gi,ci) => setForm(f=>({...f,companies:f.companies.map((c,i)=>i===gi?{...c,contacts:c.contacts.filter((_,j)=>j!==ci)}:c)}));

  const allContacts = allCompanies.flatMap(c => c.contacts||[]);
  const fillContact = (gi, ci, name) => {
    const found = allContacts.find(c => c.name?.toLowerCase() === name.toLowerCase());
    if (found) {
      updCt(gi,ci,'name', found.name);
      updCt(gi,ci,'email', found.email||'');
      updCt(gi,ci,'officePhone', found.office_phone||found.officePhone||'');
      updCt(gi,ci,'ext', found.extension||found.ext||'');
      updCt(gi,ci,'cell', found.cell_phone||found.cell||'');
    }
  };

  const submit = async () => {
    if (!form.name) { setError('Project name is required.'); return; }
    setSaving(true); setError('');
    try {
      await onCreate({
        e_number: form.eName,
        project_name: form.name,
        project_type: form.type,
        estimator_id: form.estimatorId || null,
        city: form.city,
        state: form.state,
        zip: form.zip || null,
        distance_miles: form.distance_miles || null,
        bid_date: form.bidDate || null,
        addenda: Number(form.addenda) || 0,
        tonnage: form.tonnage ? Number(form.tonnage) : null,
        ssi_price: form.ssiPrice ? Number(form.ssiPrice) : 0,
        fab_cost: form.fabCost ? Number(form.fabCost) : null,
        erect_cost: form.erectCost ? Number(form.erectCost) : null,
        sales_tax: form.salesTax || null,
        prevailing_wages: form.prevWages || null,
        square_feet: form.squareFeet ? Number(form.squareFeet) : null,
        follow_up_date: form.followUpDate || null,
        prequal: form.prequal || null,
        stage: form.stage,
        intake_sources: (form.intakeSources||[]).join(',') || null,
        project_url: form.projectUrl || null,
        intake_notes: form.intakeNotes || null,
        companies: form.companies.filter(gc => gc.name.trim()),
      });
    } catch(e) { setError(e.message); setSaving(false); }
  };

  const ic = 'w-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 transition-colors text-gray-800 dark:text-gray-200';
  const lbl = 'text-xs text-gray-500 dark:text-gray-400 mb-1 block';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">+ New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl transition-colors">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Project Info */}
          <section>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Project Info</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>E# (auto-assigned)</label><input value={form.eName} onChange={e=>set('eName',e.target.value)} className={ic} placeholder="E26-001" /></div>
              <div><label className={lbl}>Stage</label><select value={form.stage} onChange={e=>set('stage',e.target.value)} className={ic}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div className="col-span-2"><label className={lbl}>Project Name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} className={ic} placeholder="Project name" /></div>
              <div><label className={lbl}>Type</label><select value={form.type} onChange={e=>set('type',e.target.value)} className={ic}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Estimator</label><select value={form.estimatorId} onChange={e=>set('estimatorId',e.target.value)} className={ic}><option value="">— Select —</option>{estimators.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className={lbl}>City</label><input value={form.city} onChange={e=>set('city',e.target.value)} className={ic} placeholder="City" /></div>
              <div><label className={lbl}>State</label><select value={form.state} onChange={e=>set('state',e.target.value)} className={ic}>{US_STATES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div>
                <label className={lbl}>Zip Code {geocoding&&<span className="text-orange-400 animate-pulse ml-1">Looking up…</span>}</label>
                <input value={form.zip} onChange={e=>set('zip',e.target.value)} className={ic} placeholder="Auto-filled from city/state" />
              </div>
              <div>
                <label className={lbl}>Distance from Chattanooga, TN {geocoding&&<span className="text-orange-400 animate-pulse ml-1">Calculating…</span>}</label>
                <input value={form.distance} onChange={e=>set('distance',e.target.value)} className={ic} placeholder="Auto-calculated" readOnly={geocoding} />
              </div>
              <div><label className={lbl}>Bid Date</label><input type="date" value={form.bidDate} onChange={e=>set('bidDate',e.target.value)} className={ic} /></div>
              <div><label className={lbl}>Addenda</label><input type="number" value={form.addenda} onChange={e=>set('addenda',e.target.value)} className={ic} placeholder="0" /></div>
              <div><label className={lbl}>Follow-Up Date</label><input type="date" value={form.followUpDate} onChange={e=>set('followUpDate',e.target.value)} className={ic} /></div>
              <div className="col-span-2"><label className={lbl}>Pre-Qual Notes</label><textarea value={form.prequal} onChange={e=>set('prequal',e.target.value)} rows={2} className={ic+' resize-none'} /></div>
            </div>
          </section>

          {/* Pricing & Details */}
          <section>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pricing & Details</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Tonnage</label><input type="number" value={form.tonnage} onChange={e=>set('tonnage',e.target.value)} className={ic} placeholder="0" /></div>
              <div><label className={lbl}>Square Feet</label><input type="number" value={form.squareFeet} onChange={e=>set('squareFeet',e.target.value)} className={ic} placeholder="0" /></div>
              <div><label className={lbl}>SSI Price ($)</label><input type="number" value={form.ssiPrice} onChange={e=>set('ssiPrice',e.target.value)} className={ic} placeholder="0" /></div>
              <div><label className={lbl}>Fabrication Cost ($)</label><input type="number" value={form.fabCost} onChange={e=>set('fabCost',e.target.value)} className={ic} placeholder="0" /></div>
              <div><label className={lbl}>Erection Cost ($)</label><input type="number" value={form.erectCost} onChange={e=>set('erectCost',e.target.value)} className={ic} placeholder="0" /></div>
              <div><label className={lbl}>Sales Tax</label><input value={form.salesTax} onChange={e=>set('salesTax',e.target.value)} className={ic} placeholder="e.g. 9.25% or YES or NO" /></div>
              <div><label className={lbl}>Prevailing Wages</label><input value={form.prevWages} onChange={e=>set('prevWages',e.target.value)} className={ic} placeholder="e.g. DB or N/A" /></div>
            </div>
          </section>

          {/* GCs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">General Contractors</div>
              <button onClick={addGC} className="text-xs text-orange-500 hover:text-orange-400 transition-colors">+ Add GC</button>
            </div>
            <div className="space-y-4">
              {form.companies.map((gc,gi)=>(
                <div key={gi} className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input value={gc.name} onChange={e=>updGC(gi,'name',e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-orange-500" placeholder="GC / Company Name" list={`gc-${gi}`} />
                    <datalist id={`gc-${gi}`}>{allCompanies.map(c=><option key={c.id} value={c.name}/>)}</datalist>
                    {form.companies.length>1&&<button onClick={()=>rmGC(gi)} className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>}
                  </div>
                  {gc.contacts.map((c,ci)=>(
                    <div key={ci} className="grid grid-cols-2 gap-2 border-t border-gray-200 dark:border-gray-700/50 pt-3 mt-3 relative">
                      {gc.contacts.length>1&&<button onClick={()=>rmCt(gi,ci)} className="absolute right-0 top-3 text-red-400 hover:text-red-300 text-sm">×</button>}
                      <div className="col-span-2">
                        <input value={c.name} onChange={e=>{updCt(gi,ci,'name',e.target.value); fillContact(gi,ci,e.target.value);}} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Contact name (type to autofill)" list={`ct-${gi}-${ci}`}/>
                        <datalist id={`ct-${gi}-${ci}`}>{allContacts.map((ct,k)=><option key={k} value={ct.name}/>)}</datalist>
                      </div>
                      <input value={c.email} onChange={e=>updCt(gi,ci,'email',e.target.value)} className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Email"/>
                      <div className="flex gap-1">
                        <input value={c.officePhone} onChange={e=>updCt(gi,ci,'officePhone',e.target.value)} className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Office phone"/>
                        <input value={c.ext} onChange={e=>updCt(gi,ci,'ext',e.target.value)} className="w-16 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Ext"/>
                      </div>
                      <input value={c.cell} onChange={e=>updCt(gi,ci,'cell',e.target.value)} className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Cell phone"/>
                    </div>
                  ))}
                  <button onClick={()=>addCt(gi)} className="text-xs text-gray-400 hover:text-orange-500 transition-colors mt-2">+ Add Contact</button>
                </div>
              ))}
            </div>
          </section>
          {/* Intake Info — shown when stage is Projects in Review */}
          {(form.stage === 'Projects in Review') && (
          <section>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Intake Info</div>
            <div className="space-y-3">
              <div>
                <label className={lbl}>How did this come in? (select all that apply)</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {['From GC','From Sean','VIP'].map(src=>(
                    <button key={src} type="button"
                      onClick={()=>{
                        const sources = form.intakeSources||[];
                        set('intakeSources', sources.includes(src)?sources.filter(s=>s!==src):[...sources,src]);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        (form.intakeSources||[]).includes(src)
                          ?'bg-orange-500 border-orange-400 text-white'
                          :'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-orange-300'}`}>
                      {src==='VIP'?'⭐ VIP':src==='From GC'?'🏗 From GC':'👤 From Sean'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Project Drawings / Documents Link</label>
                <div className="flex gap-2">
                  <input type="url" value={form.projectUrl||''} onChange={e=>set('projectUrl',e.target.value)}
                    className={ic+' flex-1'} placeholder="https://..." />
                  {form.projectUrl && (
                    <a href={form.projectUrl} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg">Open ↗</a>
                  )}
                </div>
              </div>
              <div>
                <label className={lbl}>Intake Notes</label>
                <textarea value={form.intakeNotes||''} onChange={e=>set('intakeNotes',e.target.value)} rows={3}
                  className={ic+' resize-none'} placeholder="Why are we considering this? Any context or concerns…" />
              </div>
            </div>
          </section>
          )}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg font-semibold text-white transition-colors shadow-lg shadow-orange-500/20">
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
