'use client';
import { Building2, Check, Layers, Users } from 'lucide-react';
import { BedGrid } from './BedGrid';
import { RoomTypeBadge } from './RoomTypeBadge';
export function RoomCard({ room, selected = false, isCurrentRoom = false, onSelect, }) {
    const occupied = room.occupiedCount ?? room.beds.filter((b) => b.isOccupied).length;
    const available = room.availableCount ?? room.bedCount - occupied;
    return (<div onClick={() => onSelect && !isCurrentRoom && onSelect(room)} className={`rounded-2xl p-4 border transition-all bg-white dark:bg-slate-900 shadow-card ${onSelect && !isCurrentRoom ? 'cursor-pointer hover:border-indigo-400 hover:shadow-md' : ''} ${selected
            ? 'border-indigo-600 ring-2 ring-indigo-600/20 dark:border-indigo-400'
            : isCurrentRoom
                ? 'border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-950/10'
                : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Room {room.roomNumber}
            </h3>
            {isCurrentRoom && (<span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                Current
              </span>)}
            {selected && (<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                <Check className="w-3 h-3"/> Selected
              </span>)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
            <Building2 className="w-3.5 h-3.5"/>
            {room.hostel.code} · {room.block.name}
          </p>
        </div>
        <RoomTypeBadge type={room.type}/>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-3">
        <span className="flex items-center gap-1">
          <Layers className="w-3.5 h-3.5"/> Floor {room.floor}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5"/> {occupied}/{room.bedCount} beds ({available} free)
        </span>
        <span className="ml-auto font-medium text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
          {room.gender}
        </span>
      </div>

      <BedGrid beds={room.beds}/>
    </div>);
}
