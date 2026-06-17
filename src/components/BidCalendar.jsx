import { useState, useMemo } from 'react';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STAGE_DOT = {
  'Projects in Review':'bg-orange-400','WIP':'bg-blue-400','Sent':'bg-green-400',
  'Awarded':'bg-purple-400','Won':'bg-yellow-400','Lost':'bg-red-400','No Bid / Cancelled':'bg-gray-400',
};

export default function BidCalendar({ projects, onSelectProject }) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const bidsByDate = useMemo(() => {
    const map = {};
    projects.forEach(p => {
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

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = d => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl leading-none px-2 transition-colors">‹</button>
        <h2 className="font-bold text-lg text-gray-900 dark:text-white">{MONTHS[month]} {year}</h2>
        <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl leading-none px-2 transition-colors">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <div key={i} className={`min-h-[80px] border-r border-b border-gray-100 dark:border-gray-800 p-1.5 ${!day ? 'bg-gray-50 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-900'} ${i % 7 === 6 ? 'border-r-0' : ''}`}>
            {day && (
              <>
                <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-orange-500 text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {(bidsByDate[day] || []).map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject(p.id)}
                      className="w-full text-left group"
                    >
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs hover:opacity-80 transition-opacity ${
                        p.stage === 'Lost' || p.stage === 'No Bid / Cancelled'
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                          : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STAGE_DOT[p.stage] || 'bg-gray-400'}`} />
                        <span className="truncate font-medium">{p.eName || p.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 px-1.5 truncate hidden group-hover:block">
                        {p.estimator} · {p.name}
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
        {Object.entries(STAGE_DOT).map(([stage, color]) => (
          <div key={stage} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {stage}
          </div>
        ))}
      </div>
    </div>
  );
}
