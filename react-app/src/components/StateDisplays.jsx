import React from 'react';
import { AlertTriangle, Inbox, Loader2, X } from 'lucide-react';
export function LoadingSpinner({ label = 'Loading...' }) {
    return (<div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3"/>
      <p className="text-sm font-medium">{label}</p>
    </div>);
}
export function SkeletonCard() {
    return (<div className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse space-y-3">
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"/>
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"/>
      <div className="h-8 bg-slate-100 dark:bg-slate-800/70 rounded-xl w-full"/>
    </div>);
}
export function EmptyState({ title, description, action, }) {
    return (<div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-10 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 mb-3">
        <Inbox className="w-6 h-6"/>
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>);
}
export function ErrorState({ message, onRetry, }) {
    return (<div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 p-6 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"/>
        <div>
          <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            Unable to load data
          </h4>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (<button onClick={onRetry} className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shrink-0">
          Retry
        </button>)}
    </div>);
}
export function Modal({ open, onClose, title, children, }) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4"/>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>);
}
