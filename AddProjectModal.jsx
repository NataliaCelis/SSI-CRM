import { useState, useEffect } from 'react';
import { useNextENumber } from '../hooks/useData';

const STAGES = ['Under Review','Sent','Pending Award','Won','Lost','No Bid / Cancelled'];
const TYPES = ['GROUND UP','RENO/EXP','ADD','BUDGET','MERGER','DESIGN/BUILD','EXPANSION','RENO','ADD/RENO','SUB FAB','DEMO/RENO','REMODEL'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

function newContact() { return { name: '', email: '', officePhone: '', ext: '', cell: '' }; }
function newGC() { return { name: '', contacts: [newContact()] }; }

export default function AddProjectModal({ staff, allCompanies = [], onClose, onCreate }) {
  const autoENum = useNextENumber();
  const estimators = staff.filter(s => s.roles?.includes('Estimator'));

  const [form, setForm] = useState({
    eName: '',
    stage: 'Under Review',
    name: '',
    type: 'GROUND UP',
    estimatorId: '',
    city: '',
    state: 'TN',
    bidDate: '',
    tonnage: '',
    ssiPrice: '',
    companies: [newGC()],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (autoENum) setForm(f => ({ ...f, eName: autoENum }));
  }, [autoENum]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const updateGC = (gi, field, val) => {
    const companies = [...form.companies];
    companies[gi] = { ...companies[gi], [field]: val };
    setForm(f => ({ ...f, companies }));
  };

  const updateContact = (gi, ci, field, val) => {
    const companies = [...form.companies];
    const contacts = [...companies[gi].contacts];
    contacts[ci] = { ...contacts[ci], [field]: val };
    companies[gi] = { ...companies[gi], contacts };
    setForm(f => ({ ...f, companies }));
  };

  const addGC = () => setForm(f => ({ ...f, companies: [...f.companies, newGC()] }));
  const removeGC = gi => setForm(f => ({ ...f, companies: f.companies.filter((_, i) => i !== gi) }));
  const addContact = gi => {
    const companies = [...form.companies];
    companies[gi] = { ...companies[gi], contacts: [...companies[gi].contacts, newContact()] };
    setForm(f => ({ ...f, companies }));
  };
  const removeContact = (gi, ci) => {
    const companies = [...form.companies];
    companies[gi] = { ...companies[gi], contacts: companies[gi].contacts.filter((_, i) => i !== ci) };
    setForm(f => ({ ...f, companies }));
  };

  // Autocomplete existing contact names
  const allContacts = allCompanies.flatMap(c => c.contacts || []);
  const fillContact = (gi, ci, name) => {
    const found = allContacts.find(c => c.name === name);
    if (found) {
      updateContact(gi, ci, 'name', found.name);
      updateContact(gi, ci, 'email', found.email || '');
      updateContact(gi, ci, 'officePhone', found.office_phone || '');
      updateContact(gi, ci, 'ext', found.extension || '');
      updateContact(gi, ci, 'cell', found.cell_phone || '');
    }
  };

  const submit = async () => {
    if (!form.name) { setError('Project name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreate({
        e_number: form.eName,
        project_name: form.name,
        project_type: form.type,
        estimator_id: form.estimatorId || null,
        city: form.city,
        state: form.state,
        bid_date: form.bidDate || null,
        tonnage: form.tonnage ? Number(form.tonnage) : null,
        ssi_price: form.ssiPrice ? Number(form.ssiPrice) : 0,
        stage: form.stage,
        companies: form.companies.filter(gc => gc.name.trim()),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 transition-colors';
  const labelCls = 'text-xs font-medium text-gray-500 mb-1 block';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-lg">+ New Project</h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill in the details to create a bid</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Core fields */}
          <section>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Project Info</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>E# (auto-assigned)</label>
                <input value={form.eName} onChange={e => set('eName', e.target.value)} className={inputCls} placeholder="E26-001" />
              </div>
              <div>
                <label className={labelCls}>Stage</label>
                <select value={form.stage} onChange={e => set('stage', e.target.value)} className={inputCls}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Project Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Project name" />
              </div>
              <div>
                <label className={labelCls}>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estimator</label>
                <select value={form.estimatorId} onChange={e => set('estimatorId', e.target.value)} className={inputCls}>
                  <option value="">— Select —</option>
                  {estimators.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>City</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} placeholder="City" />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <select value={form.state} onChange={e => set('state', e.target.value)} className={inputCls}>
                  {US_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bid Date</label>
                <input type="date" value={form.bidDate} onChange={e => set('bidDate', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tonnage</label>
                <input type="number" value={form.tonnage} onChange={e => set('tonnage', e.target.value)} className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>SSI Price ($)</label>
                <input type="number" value={form.ssiPrice} onChange={e => set('ssiPrice', e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>
          </section>

          {/* GCs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">General Contractors</div>
              <button onClick={addGC} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">+ Add GC</button>
            </div>
            <div className="space-y-4">
              {form.companies.map((gc, gi) => (
                <div key={gi} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={gc.name}
                      onChange={e => updateGC(gi, 'name', e.target.value)}
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-orange-500"
                      placeholder="GC / Company Name"
                      list={`gc-list-${gi}`}
                    />
                    <datalist id={`gc-list-${gi}`}>{allCompanies.map(c => <option key={c.id} value={c.name} />)}</datalist>
                    {form.companies.length > 1 && (
                      <button onClick={() => removeGC(gi)} className="text-red-400 hover:text-red-300 text-lg leading-none transition-colors">×</button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {gc.contacts.map((c, ci) => (
                      <div key={ci} className="grid grid-cols-2 gap-2 border-t border-gray-700/50 pt-3 relative">
                        {gc.contacts.length > 1 && (
                          <button onClick={() => removeContact(gi, ci)} className="absolute right-0 top-3 text-red-400 hover:text-red-300 text-sm transition-colors">×</button>
                        )}
                        <div className="col-span-2">
                          <input
                            value={c.name}
                            onChange={e => updateContact(gi, ci, 'name', e.target.value)}
                            onBlur={e => fillContact(gi, ci, e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500"
                            placeholder="Contact name"
                            list={`contact-list-${gi}-${ci}`}
                          />
                          <datalist id={`contact-list-${gi}-${ci}`}>{allContacts.map((ct, k) => <option key={k} value={ct.name} />)}</datalist>
                        </div>
                        <input value={c.email} onChange={e => updateContact(gi, ci, 'email', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Email" />
                        <div className="flex gap-1">
                          <input value={c.officePhone} onChange={e => updateContact(gi, ci, 'officePhone', e.target.value)} className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Office phone" />
                          <input value={c.ext} onChange={e => updateContact(gi, ci, 'ext', e.target.value)} className="w-16 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Ext" />
                        </div>
                        <input value={c.cell} onChange={e => updateContact(gi, ci, 'cell', e.target.value)} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500" placeholder="Cell phone" />
                      </div>
                    ))}
                    <button onClick={() => addContact(gi)} className="text-xs text-gray-500 hover:text-orange-400 transition-colors mt-1">+ Add Contact</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {error && (
          <div className="mx-6 mb-2 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="px-6 py-4 border-t border-gray-800 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-60 rounded-lg font-semibold transition-colors shadow-lg shadow-orange-500/20">
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}
