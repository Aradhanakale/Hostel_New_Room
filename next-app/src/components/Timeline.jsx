'use client';
import { Check, Clock, X } from 'lucide-react';
const STEPS = [
    { key: 'PENDING', label: 'Request Validated' },
    { key: 'IN_CYCLE', label: 'Swap Match Found' },
    { key: 'ACCEPTANCE', label: 'All Students Accept' },
    { key: 'AWAITING_WARDEN', label: 'Warden Review' },
    { key: 'COMPLETED', label: 'Atomic Swap Done' },
];
export function Timeline({ status }) {
    const isTerminalFail = ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(status);
    const activeIndex = (() => {
        if (status === 'PENDING')
            return 0;
        if (status === 'IN_CYCLE')
            return 1;
        if (status === 'AWAITING_WARDEN')
            return 3;
        if (status === 'APPROVED' || status === 'COMPLETED')
            return 4;
        return 0;
    })();
    return (<div className="w-full py-2">
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        {STEPS.map((step, idx) => {
            const completed = !isTerminalFail && idx < activeIndex;
            const current = !isTerminalFail && idx === activeIndex;
            const doneAll = status === 'COMPLETED' && idx === 4;
            return (<div key={step.key} className="flex items-center flex-1 min-w-[95px]">
              <div className="flex flex-col items-center text-center w-full">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${completed || doneAll
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : current
                        ? 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-950'
                        : isTerminalFail && idx === 0
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                  {completed || doneAll ? (<Check className="w-4 h-4"/>) : isTerminalFail && idx === 0 ? (<X className="w-4 h-4"/>) : current ? (<Clock className="w-3.5 h-3.5"/>) : (idx + 1)}
                </div>
                <span className={`text-[11px] mt-1.5 font-medium leading-tight ${completed || doneAll || current
                    ? 'text-slate-800 dark:text-slate-100'
                    : 'text-slate-400 dark:text-slate-500'}`}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (<div className={`h-0.5 flex-1 -mt-5 mx-1 rounded ${completed ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}/>)}
            </div>);
        })}
      </div>
      {isTerminalFail && (<p className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-2">
          Request ended with status: {status}
        </p>)}
    </div>);
}
