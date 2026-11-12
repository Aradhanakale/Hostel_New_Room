'use client';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { RoomTypeBadge } from './RoomTypeBadge';
import { StatusBadge } from './StatusBadge';
export function SwapGraph({ group, currentUserId, }) {
    const participants = [...group.participants].sort((a, b) => a.stepOrder - b.stepOrder);
    const count = participants.length;
    const cx = 260;
    const cy = 170;
    const rx = count === 2 ? 155 : 165;
    const ry = count === 2 ? 40 : 112;
    const positions = participants.map((_, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        return {
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle),
        };
    });
    return (<div className="space-y-5">
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-50 via-indigo-50/40 to-teal-50/30 dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900 border border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/80 px-2.5 py-1 rounded-full">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }}/>
              {group.type === 'DIRECT' ? 'Direct 2-Way Swap' : `${count}-Way Circular Chain`}
            </span>
            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
              {group.cycleCode}
            </span>
          </div>
          <StatusBadge status={group.status}/>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 520 340" className="w-full max-w-[560px] mx-auto h-auto select-none" role="img" aria-label={`Circular swap diagram for ${group.cycleCode}`}>
            <defs>
              <marker id={`arrow-next-${group.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#4f46e5"/>
              </marker>
            </defs>

            <g transform={`translate(${cx}, ${cy})`}>
              <circle r="38" className="fill-white/90 dark:fill-slate-800/90 stroke-indigo-200 dark:stroke-indigo-800" strokeWidth="2"/>
              <text textAnchor="middle" dy="-3" className="fill-indigo-600 dark:fill-indigo-400 text-[11px] font-bold">
                {count}-WAY
              </text>
              <text textAnchor="middle" dy="12" className="fill-slate-500 dark:fill-slate-400 text-[9px] font-semibold">
                ATOMIC CYCLE
              </text>
            </g>

            {positions.map((pos, i) => {
            const next = positions[(i + 1) % count];
            const dx = next.x - pos.x;
            const dy = next.y - pos.y;
            const len = Math.hypot(dx, dy) || 1;
            const pad = 44;
            const sx = pos.x + (dx / len) * pad;
            const sy = pos.y + (dy / len) * pad;
            const ex = next.x - (dx / len) * pad;
            const ey = next.y - (dy / len) * pad;
            const mx = (sx + ex) / 2 + (count === 2 ? 0 : (cx - (sx + ex) / 2) * -0.2);
            const my = (sy + ey) / 2 +
                (count === 2 ? (i === 0 ? -55 : 55) : (cy - (sy + ey) / 2) * -0.2);
            return (<path key={`edge-${i}`} d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`} fill="none" stroke="#4f46e5" strokeWidth="2.5" className="animate-dash-flow opacity-80" markerEnd={`url(#arrow-next-${group.id})`}/>);
        })}

            {participants.map((p, i) => {
            const { x, y } = positions[i];
            const isMe = p.student.user.id === currentUserId;
            const ringColor = p.decision === 'ACCEPTED'
                ? '#10b981'
                : p.decision === 'REJECTED'
                    ? '#f43f5e'
                    : isMe
                        ? '#4f46e5'
                        : '#94a3b8';
            return (<motion.g key={p.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.08 }} transform={`translate(${x}, ${y})`}>
                  <rect x="-62" y="-32" width="124" height="64" rx="14" className={isMe
                    ? 'fill-indigo-600 dark:fill-indigo-700'
                    : 'fill-white dark:fill-slate-800'} stroke={ringColor} strokeWidth="2.5"/>
                  <text textAnchor="middle" dy="-11" className={`text-[11px] font-bold ${isMe ? 'fill-white' : 'fill-slate-900 dark:fill-white'}`}>
                    {p.student.user.name.split(' ')[0]} {isMe ? '(You)' : ''}
                  </text>
                  <text textAnchor="middle" dy="5" className={`text-[10px] font-medium ${isMe ? 'fill-indigo-100' : 'fill-slate-600 dark:fill-slate-300'}`}>
                    {p.fromRoom.roomNumber} ({p.fromBed.bedLabel}) → {p.toRoom.roomNumber}
                  </text>
                  <text textAnchor="middle" dy="20" className={`text-[9px] font-bold ${p.decision === 'ACCEPTED'
                    ? isMe
                        ? 'fill-emerald-200'
                        : 'fill-emerald-600 dark:fill-emerald-400'
                    : p.decision === 'REJECTED'
                        ? 'fill-rose-500'
                        : isMe
                            ? 'fill-amber-200'
                            : 'fill-amber-600 dark:fill-amber-400'}`}>
                    {p.decision === 'ACCEPTED'
                    ? '✓ ACCEPTED'
                    : p.decision === 'REJECTED'
                        ? '✗ REJECTED'
                        : '⏳ PENDING'}
                  </text>
                </motion.g>);
        })}
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {participants.map((p) => {
            const isMe = p.student.user.id === currentUserId;
            return (<div key={p.id} className={`rounded-xl p-3.5 border text-xs ${isMe
                    ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/30'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {p.student.user.name} {isMe && <span className="text-indigo-600">(You)</span>}
                </span>
                {p.decision === 'ACCEPTED' ? (<span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5"/> Accepted
                  </span>) : p.decision === 'REJECTED' ? (<span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                    <XCircle className="w-3.5 h-3.5"/> Rejected
                  </span>) : (<span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                    <Clock className="w-3.5 h-3.5"/> Pending
                  </span>)}
              </div>

              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-2">
                  <div className="font-semibold">
                    {p.fromRoom.roomNumber} · {p.fromBed.bedLabel}
                  </div>
                  <div className="mt-1">
                    <RoomTypeBadge type={p.fromRoom.type} size="xs"/>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-500 shrink-0"/>
                <div className="flex-1 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg p-2">
                  <div className="font-semibold text-indigo-900 dark:text-indigo-200">
                    {p.toRoom.roomNumber} · {p.toBed.bedLabel}
                  </div>
                  <div className="mt-1">
                    <RoomTypeBadge type={p.toRoom.type} size="xs"/>
                  </div>
                </div>
              </div>
            </div>);
        })}
      </div>
    </div>);
}
