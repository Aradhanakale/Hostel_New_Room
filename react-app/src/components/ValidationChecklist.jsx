import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
export function ValidationChecklist({ validation }) {
    if (!validation)
        return null;
    return (<div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-5 h-5 ${validation.passed ? 'text-emerald-600' : 'text-rose-600'}`}/>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Live Policy Validation Checklist
          </h3>
        </div>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${validation.passed
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'}`}>
          {validation.passed ? 'All Checks Passed' : 'Policy Blocked'}
        </span>
      </div>

      <div className="space-y-2">
        {validation.checks.map((c) => (<div key={c.code} className={`flex items-start gap-2.5 p-2.5 rounded-xl text-xs border ${c.passed
                ? 'bg-emerald-50/40 border-emerald-100 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-200'
                : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-200'}`}>
            {c.passed ? (<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"/>) : (<XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"/>)}
            <div>
              <p className="font-semibold">{c.title}</p>
              <p className="opacity-85 mt-0.5">{c.message}</p>
            </div>
          </div>))}
      </div>
    </div>);
}
