'use client';
import { Fan, Snowflake } from 'lucide-react';
export function RoomTypeBadge({ type, size = 'sm', }) {
    const sizeCls = size === 'xs'
        ? 'px-2 py-0.5 text-[11px] gap-1'
        : size === 'md'
            ? 'px-3 py-1 text-xs gap-1.5'
            : 'px-2.5 py-0.5 text-xs gap-1';
    if (type === 'AC') {
        return (<span className={`inline-flex items-center font-semibold rounded-full bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 ${sizeCls}`}>
        <Snowflake className="w-3.5 h-3.5 shrink-0"/>
        <span>AC</span>
      </span>);
    }
    if (type === 'NON_AC') {
        return (<span className={`inline-flex items-center font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 ${sizeCls}`}>
        <Fan className="w-3.5 h-3.5 shrink-0"/>
        <span>Non-AC</span>
      </span>);
    }
    return (<span className={`inline-flex items-center font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 ${sizeCls}`}>
      <span>Any Type</span>
    </span>);
}
