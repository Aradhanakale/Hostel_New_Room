import { BedDouble, User } from 'lucide-react';
export function BedGrid({ beds }) {
    return (<div className="flex flex-wrap gap-2">
      {beds.map((bed) => {
            const isMine = bed.isCurrentUser;
            const occupantLabel = bed.occupantName || bed.occupant?.name;
            return (<div key={bed.id} title={bed.isOccupied
                    ? `${bed.bedLabel}: Occupied by ${occupantLabel || 'Student'}`
                    : `${bed.bedLabel}: Vacant`} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${isMine
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : bed.isOccupied
                        ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 border-dashed dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'}`}>
            {bed.isOccupied ? (<User className="w-3.5 h-3.5 shrink-0"/>) : (<BedDouble className="w-3.5 h-3.5 shrink-0"/>)}
            <span>{bed.bedLabel}</span>
            {isMine && <span className="text-[10px] opacity-90">(You)</span>}
          </div>);
        })}
    </div>);
}
