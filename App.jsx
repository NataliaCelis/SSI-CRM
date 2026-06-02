import { useState, useMemo } from 'react';
import { useAuth } from './lib/AuthContext';
import { useProjects, useStaff, useCompanies } from './hooks/useData';
import { signOut } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import ProjectDetail from './components/ProjectDetail';
import AddProjectModal from './components/AddProjectModal';
import StaffDirectory from './components/StaffDirectory';

// ── Constants ──────────────────────────────────────────────
const STAGES = ['Under Review','Sent','Pending Award','Won','Lost','No Bid / Cancelled'];
const STAGE_COLORS = {
  'Under Review': 'bg-orange-100 border-orange-300 text-orange-800',
  'Sent': 'bg-green-100 border-green-300 text-green-800',
  'Pending Award': 'bg-purple-100 border-purple-300 text-purple-800',
  'Won': 'bg-yellow-100 border-yellow-400 text-yellow-800',
  'Lost': 'bg-red-100 border-red-300 text-red-800',
  'No Bid / Cancelled': 'bg-gray-100 border-gray-300 text-gray-600',
};
const STAGE_BG = {
  'Under Review': 'bg-orange-50', 'Sent': 'bg-green-50', 'Pending Award': 'bg-purple-50',
  'Won': 'bg-yellow-50', 'Lost': 'bg-red-50', 'No Bid / Cancelled': 'bg-gray-50',
};

const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const noSpin = 'appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

// ── Kanban ────────────────────────────────────────────────
function KanbanView({ projects, onSelect }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map(stage => {
        const cols = projects.filter(p => p.stage === stage);
        const borderClass = STAGE_COLORS[stage].split(' ').find(c => c.startsWith('border-'));
        return (
          <div key={stage} className="flex-shrink-0 w-64">
            <div className={`rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide border ${STAGE_COLORS[stage]}`}>
              {stage} <span className="ml-1 opacity-60">({cols.length})</span>
            </div>
            <div className={`rounded-b-lg min-h-32 space-y-2 p-2 ${STAGE_BG[stage]} border border-t-0 ${borderClass}`}>
              {cols.map(p => (
                <div key={p.id} onClick={() => onSelect(p.id)}
                  className="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-gray-100">
                  <div className="text-xs text-gray-400 font-mono">{p.eName || '—'}</div>
                  <div className="font-semibold text-gray-800 text-sm leading-tight mt-0.5 line-clamp-2">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.city}, {p.state} · {fmtDate(p.bidDate)}</div>
                  <div className="text-xs font-bold text-gray-700 mt-1">{fmt(p.ssiPrice)}</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.companies.slice(0, 3).map((c, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{c.name}</span>
                    ))}
                    {p.companies.length > 3 && <span className="text-xs text-gray-400">+{p.companies.length - 3}</span>}
                  </div>
                  {p.tasks.filter(t => t.status !== 'Done').length > 0 && (
                    <div className="text-xs text-orange-500 mt-1">
                      ⚑ {p.tasks.filter(t => t.status !== 'Done').length} open task{p.tasks.filter(t => t.status !== 'Done').length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────
function TableView({ projects, onSelect, sortBy, sortDir, onSort }) {
  const cols = [
    { key: 'eName', label: 'E#' },
    { key: 'name', label: 'Project' },
    { key: 'bidDate', label: 'Bid Date' },
    { key: 'addenda', label: 'Add.' },
    { key: 'state', label: 'State' },
    { key: 'type', label: 'Type' },
    { key: 'estimator', label: 'Estimator' },
    { key: 'ssiPrice', label: 'SSI Price' },
    { key: 'stage', label: 'Stage' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {cols.map(c => (
              <th key={c.key}
                onClick={() => onSort(c.key)}
                className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-50 select-none whitespace-nowrap">
                {c.label}
                {sortBy === c.key && <span className="ml-1 text-orange-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr key={p.id}
              onClick={() => onSelect(p.id)}
              className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-orange-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.eName}</td>
              <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{p.name}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(p.bidDate)}</td>
              <td className="px-4 py-3 text-gray-600">{p.addenda}</td>
              <td className="px-4 py-3 text-gray-600">{p.state}</td>
              <td className="px-4 py-3 text-gray-600 text-xs">{p.type}</td>
              <td className="px-4 py-3 text-gray-600">{p.estimator}</td>
              <td className="px-4 py-3 font-semibold text-gray-800">{fmt(p.ssiPrice)}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STAGE_COLORS[p.stage]}`}>{p.stage}</span>
              </td>
            </tr>
          ))}
          {!projects.length && (
            <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400 text-sm">No projects found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const { user, staff: currentStaff, loading } = useAuth();
  const { projects, loading: projLoading, actions } = useProjects();
  const { staff, reload: reloadStaff } = useStaff();
  const allCompanies = useCompanies();

  const [view, setView] = useState('kanban');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [sortBy, setSortBy] = useState('bidDate');
  const [sortDir, setSortDir] = useState('desc');

  // Filters
  const [search, setSearch] = useState('');
  const [filterEstimator, setFilterEstimator] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterState, setFilterState] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterGC, setFilterGC] = useState('');
  const [filterContact, setFilterContact] = useState('');
  const [filterAwardedGC, setFilterAwardedGC] = useState('');
  const [filterSteelSub, setFilterSteelSub] = useState('');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = useMemo(() => {
    let r = [...projects];
    if (search) r = r.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.eName || '').toLowerCase().includes(search.toLowerCase()) ||
      p.companies.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
    );
    if (filterEstimator) r = r.filter(p => p.estimator?.toUpperCase() === filterEstimator);
    if (filterStage) r = r.filter(p => p.stage === filterStage);
    if (filterState) r = r.filter(p => p.state === filterState);
    if (filterGC) r = r.filter(p => p.companies.some(c => c.name.toLowerCase().includes(filterGC.toLowerCase())));
    if (filterContact) r = r.filter(p => p.companies.some(c => c.contacts.some(ct => ct.name?.toLowerCase().includes(filterContact.toLowerCase()))));
    if (filterAwardedGC) r = r.filter(p => (p.awardedGC || '').toLowerCase().includes(filterAwardedGC.toLowerCase()));
    if (filterSteelSub) r = r.filter(p => (p.awardedSub || '').toLowerCase().includes(filterSteelSub.toLowerCase()));
    if (filterPriceMin) r = r.filter(p => p.ssiPrice >= Number(filterPriceMin));
    if (filterPriceMax) r = r.filter(p => p.ssiPrice <= Number(filterPriceMax));
    if (filterDateFrom) r = r.filter(p => p.bidDate && p.bidDate >= filterDateFrom);
    if (filterDateTo) r = r.filter(p => p.bidDate && p.bidDate <= filterDateTo);
    return r;
  }, [projects, search, filterEstimator, filterStage, filterState, filterGC, filterContact, filterAwardedGC, filterSteelSub, filterPriceMin, filterPriceMax, filterDateFrom, filterDateTo]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    let va = a[sortBy] || '', vb = b[sortBy] || '';
    if (sortBy === 'ssiPrice') return sortDir === 'asc' ? va - vb : vb - va;
    if (sortBy === 'bidDate') return sortDir === 'asc' ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }), [filtered, sortBy, sortDir]);

  const handleSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setFilterGC(''); setFilterContact(''); setFilterAwardedGC(''); setFilterSteelSub('');
    setFilterPriceMin(''); setFilterPriceMax(''); setFilterDateFrom(''); setFilterDateTo('');
  };

  const activeFilterCount = [filterGC, filterContact, filterAwardedGC, filterSteelSub, filterPriceMin, filterPriceMax, filterDateFrom, filterDateTo].filter(Boolean).length;

  const totals = {
    review: projects.filter(p => p.stage === 'Under Review').reduce((a, p) => a + p.ssiPrice, 0),
    sent: projects.filter(p => p.stage === 'Sent' || p.stage === 'Pending Award').reduce((a, p) => a + p.ssiPrice, 0),
    won: projects.filter(p => p.stage === 'Won').reduce((a, p) => a + p.ssiPrice, 0),
  };

  const selectedProject = projects.find(p => p.id === selected);

  // Loading / auth gate
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-black text-sm">SSI</span>
          </div>
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const inputCls = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 transition-colors';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-orange-500/30">SSI</div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Steel Bid Pipeline</h1>
            <p className="text-xs text-gray-500">Southern Spear Ironworks</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowStaff(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium transition-colors">
            👥 Staff
          </button>
          <div className="text-right text-xs text-gray-500">
            <div>Signed in as <span className="text-orange-400 font-medium">{currentStaff?.name || user.email}</span></div>
            <div>{currentStaff?.roles?.join(', ')}</div>
          </div>
          <button onClick={signOut}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs font-medium transition-colors text-gray-400 hover:text-white">
            Sign Out
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex gap-6 text-sm overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          <span className="text-gray-400">Under Review:</span>
          <span className="font-semibold text-orange-300">{fmt(totals.review)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          <span className="text-gray-400">Sent/Pending:</span>
          <span className="font-semibold text-green-300">{fmt(totals.sent)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
          <span className="text-gray-400">Won:</span>
          <span className="font-semibold text-yellow-300">{fmt(totals.won)}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-gray-500">Total Projects:</span>
          <span className="font-semibold">{projects.length}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-3 flex flex-wrap gap-3 items-center border-b border-gray-800 bg-gray-900">
        <input
          className={`${inputCls} w-52`}
          placeholder="Search projects, GCs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={inputCls} value={filterEstimator} onChange={e => setFilterEstimator(e.target.value)}>
          <option value="">All Estimators</option>
          {[...new Set(staff.filter(s => s.roles?.includes('Estimator')).map(s => s.name.toUpperCase()))].map(e => (
            <option key={e}>{e}</option>
          ))}
        </select>
        <select className={inputCls} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls} value={filterState} onChange={e => setFilterState(e.target.value)}>
          <option value="">All States</option>
          {[...new Set(projects.map(p => p.state))].filter(Boolean).sort().map(s => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showFilters ? 'bg-orange-500 border-orange-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
        >
          ⚙ Filters {activeFilterCount > 0 && <span className="ml-1 bg-orange-600 text-white text-xs rounded-full px-1.5">{activeFilterCount}</span>}
        </button>
        <div className="flex gap-1 ml-auto">
          {['kanban', 'table'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${view === v ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {v === 'kanban' ? 'Pipeline' : 'Table'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-orange-500/20">
          + New Project
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900 flex flex-wrap gap-4 items-end text-sm">
          {[
            { label: 'GC Bidding', val: filterGC, set: setFilterGC, list: [...new Set(projects.flatMap(p => p.companies.map(c => c.name)))].sort() },
            { label: 'Contact', val: filterContact, set: setFilterContact, list: [...new Set(projects.flatMap(p => p.companies.flatMap(c => c.contacts.map(ct => ct.name).filter(Boolean))))].sort() },
            { label: 'Awarded GC', val: filterAwardedGC, set: setFilterAwardedGC, list: [...new Set(projects.map(p => p.awardedGC).filter(Boolean))].sort() },
            { label: 'Steel Sub', val: filterSteelSub, set: setFilterSteelSub, list: [...new Set(projects.map(p => p.awardedSub).filter(Boolean))].sort() },
          ].map(({ label, val, set, list }, i) => (
            <div key={i}>
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <input
                className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500"
                placeholder={`${label}…`}
                value={val}
                onChange={e => set(e.target.value)}
                list={`filter-list-${i}`}
              />
              <datalist id={`filter-list-${i}`}>{list.map(n => <option key={n} value={n} />)}</datalist>
            </div>
          ))}
          <div>
            <div className="text-xs text-gray-400 mb-1">SSI Price ($)</div>
            <div className="flex items-center gap-1">
              <input type="number" placeholder="Min" className={`w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 ${noSpin}`} value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} />
              <span className="text-gray-500">–</span>
              <input type="number" placeholder="Max" className={`w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500 ${noSpin}`} value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Bid Date Range</div>
            <div className="flex items-center gap-1">
              <input type="date" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              <span className="text-gray-500">–</span>
              <input type="date" className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-orange-500" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 self-end">
            <button onClick={() => setView('table')} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-medium text-white transition-colors">🔍 Search</button>
            <button onClick={clearFilters} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs text-gray-300 transition-colors">Clear All</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="p-6">
        {projLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-gray-600">
              <div className="text-3xl mb-2 animate-spin">⚙</div>
              <div className="text-sm">Loading projects…</div>
            </div>
          </div>
        ) : view === 'kanban'
          ? <KanbanView projects={filtered} onSelect={setSelected} />
          : <TableView projects={sorted} onSelect={setSelected} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
        }
      </div>

      {/* Modals & panels */}
      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          staff={staff}
          onClose={() => setSelected(null)}
          onUpdate={actions.update}
          onUpdateStage={actions.updateStage}
          onAddNote={actions.addNote}
          onAddTask={actions.addTask}
          onUpdateTask={actions.updateTask}
        />
      )}

      {showAdd && (
        <AddProjectModal
          staff={staff}
          allCompanies={allCompanies}
          onClose={() => setShowAdd(false)}
          onCreate={async (data) => {
            await actions.create(data);
            setShowAdd(false);
          }}
        />
      )}

      {showStaff && (
        <StaffDirectory
          staff={staff}
          onClose={() => setShowStaff(false)}
          onSave={() => reloadStaff()}
        />
      )}
    </div>
  );
}
