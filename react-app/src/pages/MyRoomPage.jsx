import { Building2, CheckCircle2, Mail, ShieldAlert, Users } from 'lucide-react';
import { BedGrid } from '../components/BedGrid';
import { RoomTypeBadge } from '../components/RoomTypeBadge';
import { EmptyState } from '../components/StateDisplays';
import { useAuth } from '../context/AuthContext';
export function MyRoomPage() {
    const { user } = useAuth();
    const stu = user?.student;
    const room = stu?.currentRoom;
    if (!stu || !room) {
        return (<EmptyState title="No Room Assigned" description="You do not currently have an active hostel room allocation."/>);
    }
    return (<div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">My Room & Allocation</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your verified hostel, bed assignment, AC status, and roommates.
        </p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-extrabold">Room {room.roomNumber}</h2>
              <RoomTypeBadge type={room.type} size="md"/>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
              <Building2 className="w-4 h-4"/>
              {room.hostel.name} ({room.hostel.code}) · {room.block.name} · Floor {room.floor}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 block">Assigned Bed</span>
              <span className="font-extrabold text-indigo-700 dark:text-indigo-300 text-sm">
                {stu.currentBed?.bedLabel} of {room.bedCount}-Bed
              </span>
            </div>

            <div className={`px-3.5 py-2 rounded-xl border text-xs flex items-center gap-2 ${stu.acEligible
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'}`}>
              {stu.acEligible ? (<CheckCircle2 className="w-4 h-4 shrink-0"/>) : (<ShieldAlert className="w-4 h-4 shrink-0"/>)}
              <div>
                <span className="block font-bold">
                  {stu.acEligible ? 'AC Fee Paid' : 'Non-AC Fee Only'}
                </span>
                <span className="opacity-80">
                  {stu.acEligible ? 'Eligible for AC swaps' : 'Blocked from AC upgrades'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Bed Layout & Occupancy ({room.beds.filter((b) => b.isOccupied).length}/{room.bedCount}{' '}
            Occupied)
          </h3>
          <BedGrid beds={room.beds}/>
        </div>
      </div>

      {/* Roommates Section */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-card">
        <h3 className="text-base font-bold flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-indigo-600"/> Current Roommates ({stu.roommates.length})
        </h3>
        {stu.roommates.length === 0 ? (<p className="text-sm text-slate-500">
            No other occupants in this room right now.
          </p>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stu.roommates.map((rm) => (<div key={rm.studentId} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{rm.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Bed {rm.bedLabel}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {rm.rollNumber} · {rm.branch} Year {rm.year}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-2">
                  <Mail className="w-3.5 h-3.5"/> {rm.email}
                </p>
              </div>))}
          </div>)}
      </div>
    </div>);
}
