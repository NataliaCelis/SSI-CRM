import { useState, useMemo } from 'react';
import { useAuth } from './lib/AuthContext';
import { useProjects, useStaff, useCompanies, useAppSettings } from './hooks/useData';
import { signOut } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import ProjectDetail from './components/ProjectDetail';
import AddProjectModal from './components/AddProjectModal';
import StaffDirectory from './components/StaffDirectory';
import EmailTemplateModal from './components/EmailTemplateModal';

const STAGES = ['Projects in Review','WIP','Sent','Pending Award','Won','Lost','No Bid / Cancelled'];
const STAGE_COLORS = {
  'Projects in Review':'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300',
  'Sent':'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
  'Pending Award':'bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300',
  'Won':'bg-yellow-100 border-yellow-400 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300',
  'WIP':'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
  'Lost':'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
  'No Bid / Cancelled':'bg-gray-100 border-gray-300 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400',
};
const STAGE_PILL = {
  'Projects in Review':'bg-orange-500','Sent':'bg-green-500','Pending Award':'bg-purple-500',
  'Won':'bg-yellow-500','WIP':'bg-blue-500','Lost':'bg-red-500','No Bid / Cancelled':'bg-gray-500',
};

const fmt = n => n ? '$' + Number(n).toLocaleString() : '—';
const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const noSpin = 'appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

// ── Kanban ─────────────────────────────────────────────────
function KanbanView({ projects, onSelect }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 pb-4">
      {STAGES.map(stage => {
        const cols = projects.filter(p => p.stage === stage);
        return (
          <div key={stage} className="min-w-0">
            <div className={`rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide border ${STAGE_COLORS[stage]}`}>
              {stage} <span className="ml-1 opacity-60">({cols.length})</span>
            </div>
            <div className="rounded-b-lg min-h-16 space-y-2 p-2 bg-gray-50 dark:bg-gray-800/30 border border-t-0 border-gray-200 dark:border-gray-700">
              {cols.map(p => (
                <div key={p.id} onClick={() => onSelect(p.id)}
                  className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-all border border-gray-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600">
                  <div className="text-xs text-gray-400 font-mono">{p.eName || '—'}</div>
                  <div className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight mt-0.5 line-clamp-2">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{p.city}, {p.state}</div>
                  <div className="text-xs text-gray-400">{fmtDate(p.bidDate)}</div>
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mt-1">{fmt(p.ssiPrice)}</div>
                  {p.stage === 'Lost' && p.awardedPrice > 0 && (
                    <div className="text-xs font-semibold text-red-500 mt-0.5">Awarded: {fmt(p.awardedPrice)}</div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.companies.slice(0, 2).map((c, i) => <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded px-1.5 py-0.5">{c.name}</span>)}
                    {p.companies.length > 2 && <span className="text-xs text-gray-400">+{p.companies.length - 2}</span>}
                  </div>
                  {p.tasks.filter(t => t.status !== 'Done').length > 0 && (
                    <div className="text-xs text-orange-500 mt-1">⚑ {p.tasks.filter(t => t.status !== 'Done').length} open task{p.tasks.filter(t => t.status !== 'Done').length > 1 ? 's' : ''}</div>
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

// ── CSV Export ─────────────────────────────────────────────
function exportToCSV(projects) {
  const headers = [
    'E#','Project Name','Type','Estimator','City','State','Zip','Bid Date',
    'Addenda','Tonnage','SSI Price','FAB Cost','Erect Cost','Sales Tax',
    'Prevailing Wages','Distance (Miles)','Stage','Awarded GC','Steel Sub',
    'Awarded Price','Awarded GC Contact','Awarded GC Phone','Awarded GC Email',
    'Award Notes','Our Tonnage','Winning Sub Tonnage','Winning Sub Price',
    'Follow-Up Date','Pre-Qual Notes','GCs','Created'
  ];

  const escape = val => {
    if (val == null || val === '') return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = projects.map(p => [
    p.eName, p.name, p.type, p.estimator, p.city, p.state, p.zip || '',
    p.bidDate, p.addenda, p.tonnage, p.ssiPrice, p.fabCost, p.erectCost,
    p.salesTax, p.prevWages, p.distance_miles || '',
    p.stage, p.awardedGC, p.awardedSub,
    p.stage === 'Lost' ? p.awardedPrice : '',
    p.awardedGCContact, p.awardedGCPhone, p.awardedGCEmail,
    p.awardNotes, p.ourTonnage, p.winnerTonnage, p.winnerPrice,
    p.followUpDate, p.prequal,
    p.companies.map(c => c.name).join(' | '),
    p.bidDate,
  ].map(escape).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SSI_Bids_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Table ──────────────────────────────────────────────────
function TableView({ projects, onSelect, sortBy, sortDir, onSort }) {
  const cols = [
    { key: 'eName', label: 'E#' }, { key: 'name', label: 'Project' },
    { key: 'bidDate', label: 'Bid Date' }, { key: 'addenda', label: 'Add.' },
    { key: 'state', label: 'State' }, { key: 'type', label: 'Type' },
    { key: 'estimator', label: 'Estimator' }, { key: 'ssiPrice', label: 'SSI Price' },
    { key: 'awardedPrice', label: 'Awarded Price' }, { key: 'stage', label: 'Stage' },
  ];
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => exportToCSV(projects)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
          ⬇ Export to Excel / CSV
        </button>
      </div>
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm overflow-x-auto">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {cols.map(c => (
              <th key={c.key} onClick={() => onSort(c.key)}
                className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none whitespace-nowrap">
                {c.label}{sortBy === c.key && <span className="ml-1 text-orange-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr key={p.id} onClick={() => onSelect(p.id)}
              className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/10 ${i % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'}`}>
              <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.eName}</td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100 max-w-xs truncate">{p.name}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{fmtDate(p.bidDate)}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.addenda}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.state}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{p.type}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.estimator}</td>
              <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-100">{fmt(p.ssiPrice)}</td>
              <td className="px-4 py-3 font-semibold text-red-500">{p.stage === 'Lost' && p.awardedPrice ? fmt(p.awardedPrice) : ''}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white font-medium ${STAGE_PILL[p.stage]}`}>{p.stage}</span>
              </td>
            </tr>
          ))}
          {!projects.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">No projects found.</td></tr>}
        </tbody>
      </table>
    </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const { user, staff: currentStaff, loading, isManager, darkMode, setDarkMode } = useAuth();
  const { projects, loading: projLoading, actions } = useProjects();
  const { staff, reload: reloadStaff } = useStaff();
  const { companies } = useCompanies();
  const { settings, save: saveSetting } = useAppSettings();

  const [view, setView] = useState('kanban');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [sortBy, setSortBy] = useState('bidDate');
  const [sortDir, setSortDir] = useState('desc');
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
    if (search) r = r.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.eName || '').toLowerCase().includes(search.toLowerCase()) || p.companies.some(c => c.name.toLowerCase().includes(search.toLowerCase())));
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
    if (sortBy === 'ssiPrice' || sortBy === 'awardedPrice') return sortDir === 'asc' ? va - vb : vb - va;
    if (sortBy === 'bidDate') return sortDir === 'asc' ? new Date(va) - new Date(vb) : new Date(vb) - new Date(va);
    return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  }), [filtered, sortBy, sortDir]);

  const handleSort = col => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('asc'); } };
  const clearFilters = () => {
    setSearch('');
    setFilterEstimator('');
    setFilterStage('');
    setFilterState('');
    setFilterGC('');
    setFilterContact('');
    setFilterAwardedGC('');
    setFilterSteelSub('');
    setFilterPriceMin('');
    setFilterPriceMax('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };
  const activeFilterCount = [search, filterEstimator, filterStage, filterState, filterGC, filterContact, filterAwardedGC, filterSteelSub, filterPriceMin, filterPriceMax, filterDateFrom, filterDateTo].filter(Boolean).length;

  const totals = {
    sent: projects.filter(p => p.stage === 'Sent' || p.stage === 'Pending Award').reduce((a, p) => a + p.ssiPrice, 0),
    won: projects.filter(p => p.stage === 'Won').reduce((a, p) => a + p.ssiPrice, 0),
    wip: projects.filter(p => p.stage === 'WIP').reduce((a, p) => a + p.ssiPrice, 0),
    lost: projects.filter(p => p.stage === 'Lost').reduce((a, p) => a + (p.awardedPrice || p.ssiPrice || 0), 0),
  };

  const selectedProject = projects.find(p => p.id === selected);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <span className="text-white font-black text-sm">SSI</span>
        </div>
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;

  const inpCls = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-500 transition-colors text-gray-800 dark:text-gray-200';
  const btnCls = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center font-black text-white text-sm shadow-lg shadow-orange-500/30 flex-shrink-0">SSI</div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-lg leading-tight tracking-tight">Steel Bid Pipeline</h1>
            <p className="text-xs text-gray-500">Southern Spear Ironworks</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Dark mode toggle */}
          <button onClick={() => setDarkMode(d => !d)} className={`${btnCls} bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300`} title="Toggle dark mode">
            {darkMode ? '☀' : '☾'}
          </button>
          {isManager && (
            <button onClick={() => setShowEmailTemplate(true)} className={`${btnCls} bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs`}>
              Email Template
            </button>
          )}
          <button onClick={() => setShowStaff(true)} className={`${btnCls} bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300`}>
            Staff Directory
          </button>
          <div className="text-right text-xs text-gray-500 hidden sm:block">
            <div>Signed in as <span className="text-orange-500 font-medium">{currentStaff?.name || user.email}</span></div>
            <div>{currentStaff?.roles?.join(', ')}</div>
          </div>
          <button onClick={signOut} className={`${btnCls} bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-500 text-xs`}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2.5 flex gap-4 sm:gap-6 text-sm overflow-x-auto">
        {[
          { label: 'Sent/Pending', value: totals.sent, color: 'bg-green-400', textColor: 'text-green-500 dark:text-green-400' },
          { label: 'WIP', value: totals.wip, color: 'bg-blue-400', textColor: 'text-blue-500 dark:text-blue-400' },
          { label: 'Won', value: totals.won, color: 'bg-yellow-400', textColor: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Lost', value: totals.lost, color: 'bg-red-400', textColor: 'text-red-500 dark:text-red-400' },
        ].map(({ label, value, color, textColor }) => (
          <div key={label} className="flex items-center gap-2 flex-shrink-0">
            <span className={`w-2 h-2 rounded-full ${color} inline-block`} />
            <span className="text-gray-400 text-xs">{label}:</span>
            <span className={`font-semibold text-xs sm:text-sm ${textColor}`}>{fmt(value)}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <span className="text-gray-400 text-xs">Projects:</span>
          <span className="font-semibold">{projects.length}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-2 items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <input className={`${inpCls} w-44`} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={inpCls} value={filterEstimator} onChange={e => setFilterEstimator(e.target.value)}>
          <option value="">All Estimators</option>
          {[...new Set(staff.filter(s => s.roles?.includes('Estimator')).map(s => s.name.toUpperCase()))].map(e => <option key={e}>{e}</option>)}
        </select>
        <select className={inpCls} value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>{STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={inpCls} value={filterState} onChange={e => setFilterState(e.target.value)}>
          <option value="">All States</option>
          {[...new Set(projects.map(p => p.state))].filter(Boolean).sort().map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => setShowFilters(f => !f)}
          className={`${btnCls} border ${showFilters ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
          Filters {activeFilterCount > 0 && <span className="ml-1 bg-orange-600 text-white text-xs rounded-full px-1.5">{activeFilterCount}</span>}
        </button>
        <div className="flex gap-1 ml-auto">
          {['kanban', 'table'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`${btnCls} capitalize ${view === v ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              {v === 'kanban' ? 'Pipeline' : 'Table'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className={`${btnCls} bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 font-semibold`}>
          + New Project
        </button>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap gap-4 items-end">
          {[
            { label: 'GC Bidding', val: filterGC, set: setFilterGC, list: [...new Set(projects.flatMap(p => p.companies.map(c => c.name)))].sort() },
            { label: 'Contact', val: filterContact, set: setFilterContact, list: [...new Set(projects.flatMap(p => p.companies.flatMap(c => c.contacts.map(ct => ct.name).filter(Boolean))))].sort() },
            { label: 'Awarded GC', val: filterAwardedGC, set: setFilterAwardedGC, list: [...new Set(projects.map(p => p.awardedGC).filter(Boolean))].sort() },
            { label: 'Steel Sub', val: filterSteelSub, set: setFilterSteelSub, list: [...new Set(projects.map(p => p.awardedSub).filter(Boolean))].sort() },
          ].map(({ label, val, set, list }, i) => (
            <div key={i}>
              <div className="text-xs text-gray-400 mb-1">{label}</div>
              <input className={`w-36 ${inpCls}`} placeholder={`${label}…`} value={val} onChange={e => set(e.target.value)} list={`fl-${i}`} />
              <datalist id={`fl-${i}`}>{list.map(n => <option key={n} value={n} />)}</datalist>
            </div>
          ))}
          <div>
            <div className="text-xs text-gray-400 mb-1">SSI Price ($)</div>
            <div className="flex items-center gap-1">
              <input type="number" placeholder="Min" className={`w-24 ${inpCls} ${noSpin}`} value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} />
              <span className="text-gray-400">–</span>
              <input type="number" placeholder="Max" className={`w-24 ${inpCls} ${noSpin}`} value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Bid Date Range</div>
            <div className="flex items-center gap-1">
              <input type="date" className={inpCls} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              <span className="text-gray-400">–</span>
              <input type="date" className={inpCls} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 self-end">
            <button onClick={() => setView('table')} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs font-medium text-white">Search</button>
            <button onClick={clearFilters} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs text-gray-600 dark:text-gray-300">Clear All</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="p-4 sm:p-6">
        {projLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-gray-400">
              <div className="text-3xl mb-2 animate-spin inline-block">⚙</div>
              <div className="text-sm mt-2">Loading projects…</div>
            </div>
          </div>
        ) : view === 'kanban'
          ? <KanbanView projects={filtered} onSelect={setSelected} />
          : <TableView projects={sorted} onSelect={setSelected} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
        }
      </div>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          staff={staff}
          allContacts={companies.flatMap(c => c.contacts || [])}
          onClose={() => setSelected(null)}
          onUpdate={actions.update}
          onUpdateStage={actions.updateStage}
          onDelete={async (id, deletedById) => { await actions.delete(id, deletedById); setSelected(null); }}
          onAddNote={actions.addNote}
          onDeleteNote={actions.deleteNote}
          onAddTask={actions.addTask}
          onUpdateTask={actions.updateTask}
          onDeleteTask={actions.deleteTask}
          onSaveCompanies={actions.upsertCompanies}
          emailTemplate={settings.task_email_template}
        />
      )}
      {showAdd && <AddProjectModal staff={staff} allCompanies={companies} onClose={() => setShowAdd(false)} onCreate={async d => { await actions.create(d); setShowAdd(false); }} />}
      {showStaff && <StaffDirectory staff={staff} onClose={() => setShowStaff(false)} onSave={reloadStaff} />}
      {showEmailTemplate && isManager && <EmailTemplateModal current={settings.task_email_template} onSave={saveSetting} onClose={() => setShowEmailTemplate(false)} />}
    </div>
  );
}
