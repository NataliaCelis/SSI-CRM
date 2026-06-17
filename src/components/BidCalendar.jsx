import { useState, useMemo } from 'react';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STAGE_COLOR = {
  'Projects in Review':'bg-orange-500','WIP':'bg-blue-500','Sent':'bg-green-500',
  'Awarded':'bg-purple-500','Won':'bg-yellow-500','Lost':'bg-red-400','No Bid / Cancelled':'bg-gray-400',
};

export default function BidCalendar({ projects, onSelectProject }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const bidsByDate = useMemo(() => {
    const map = {};
    (projects || []).forEach(p => {
      if (!p.bidDate) return;
      const d = new Date(p.bidDate + 'T12:00:00');
      if (d.getMonth() === month && d.getFullYear() === year) {
        const key = d.getDate();
        if (!map[key]) map[key] = [];
        map[key].push(p);
      }
    });
    return map;
  }, [projects, month, year]);

  // Upcoming bids this month
  const upcoming = useMemo(() => {
    const todayDate = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    return (projects || [])
      .filter(p => {
        if (!p.bidDate) return false;
        const d = new Date(p.bidDate + 'T12:00:00');
        return d >= new Date(todayYear, todayMonth, todayDate) &&
               d.getMonth() === month && d.getFullYear() === year;
      })
      .sort((a, b) => new Date(a.bidDate) - new Date(b.bidDate))
      .slice(0, 8);
  }, [projects, month, year]);

  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const goToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); };

  const isToday = d => d===today.getDate() && month===today.getMonth() && year===today.getFullYear();
  const isPast = d => new Date(year,month,d) < new Date(today.getFullYear(),today.getMonth(),today.getDate());

  const cells = [];
  for (let i=0;i<firstDay;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const fmtDate = d => d ? new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Calendar */}
        <div className="xl:col-span-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-lg">‹</button>
              <h2 className="font-bold text-lg text-gray-900 dark:text-white min-w-[180px] text-center">{MONTHS[month]} {year}</h2>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors text-lg">›</button>
            </div>
            <button onClick={goToday} className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">Today</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            {DAYS.map(d=>(
              <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2.5">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-gray-800">
            {cells.map((day,i)=>(
              <div key={i} className={`min-h-[90px] p-1.5 ${
                !day ? 'bg-gray-50 dark:bg-gray-800/20' :
                isToday(day) ? 'bg-orange-50 dark:bg-orange-900/10' :
                isPast(day) ? 'bg-gray-50/50 dark:bg-gray-800/20' :
                'bg-white dark:bg-gray-900'
              }`}>
                {day && (
                  <>
                    <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday(day) ? 'bg-orange-500 text-white' :
                      isPast(day) ? 'text-gray-400 dark:text-gray-600' :
                      'text-gray-700 dark:text-gray-300'
                    }`}>{day}</div>
                    <div className="space-y-0.5">
                      {(bidsByDate[day]||[]).map(p=>(
                        <button key={p.id} onClick={()=>onSelectProject(p.id)}
                          className="w-full text-left group/card hover:opacity-90 transition-opacity">
                          <div className={`rounded px-1.5 py-0.5 flex items-center gap-1 ${STAGE_COLOR[p.stage]||'bg-gray-400'} bg-opacity-10 border border-opacity-20 ${STAGE_COLOR[p.stage]?.replace('bg-','border-')}`}
                            style={{backgroundColor: getComputedBg(p.stage)}}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STAGE_COLOR[p.stage]||'bg-gray-400'}`}/>
                            <span className="text-xs font-medium truncate text-gray-700 dark:text-gray-200">{p.eName||p.name}</span>
                          </div>
                          <div className="text-xs text-gray-400 px-1 truncate opacity-0 group-hover/card:opacity-100 transition-opacity text-left">
                            {p.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-3">
            {Object.entries(STAGE_COLOR).map(([stage,color])=>(
              <div key={stage} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span className={`w-2 h-2 rounded-full ${color}`}/>
                {stage}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar — upcoming bids */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Upcoming Bids</h3>
            <p className="text-xs text-gray-400 mt-0.5">{MONTHS[month]} {year}</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800 overflow-y-auto max-h-[500px]">
            {upcoming.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No upcoming bids this month</div>
            )}
            {upcoming.map(p => (
              <button key={p.id} onClick={()=>onSelectProject(p.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-gray-400">{p.eName}</div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate leading-tight mt-0.5">{p.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">{p.estimator}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full text-white font-medium ${STAGE_COLOR[p.stage]||'bg-gray-400'}`}>{p.stage}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-orange-500">{fmtDate(p.bidDate)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{daysUntil(p.bidDate)}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getComputedBg(stage) {
  const map = {
    'Projects in Review':'rgba(249,115,22,0.08)',
    'WIP':'rgba(59,130,246,0.08)',
    'Sent':'rgba(34,197,94,0.08)',
    'Awarded':'rgba(168,85,247,0.08)',
    'Won':'rgba(234,179,8,0.08)',
    'Lost':'rgba(239,68,68,0.08)',
    'No Bid / Cancelled':'rgba(156,163,175,0.08)',
  };
  return map[stage]||'rgba(156,163,175,0.08)';
}

function daysUntil(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr+'T12:00:00'); d.setHours(0,0,0,0);
  const diff = Math.round((d-today)/(1000*60*60*24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `in ${diff}d`;
}
