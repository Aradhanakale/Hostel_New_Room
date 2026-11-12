'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftRight, BedDouble, Bell, CheckCircle2, GitCommitHorizontal, PlusCircle, ShieldAlert, Sparkles, } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { RoomTypeBadge } from '@/components/RoomTypeBadge';
import { ErrorState, LoadingSpinner } from '@/components/StateDisplays';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/context/Providers';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';
function DashboardContent() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [matches, setMatches] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [reqRes, matchRes, notifRes] = await Promise.all([
                apiClient.get('/exchanges'),
                apiClient.get('/swaps/matches'),
                apiClient.get('/notifications'),
            ]);
            setRequests(reqRes.data.data || []);
            setMatches(matchRes.data.data || []);
            setNotifications((notifRes.data.data.notifications || []).slice(0, 4));
        }
        catch (err) {
            setError(getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, []);
    if (loading)
        return <LoadingSpinner label="Loading student dashboard..."/>;
    if (error)
        return <ErrorState message={error} onRetry={loadData}/>;
    const stu = user?.student;
    const room = stu?.currentRoom;
    const activeMatch = matches.find((m) => m.status === 'AWAITING_ACCEPTANCE' || m.status === 'AWAITING_WARDEN');
    const activeRequest = requests.find((r) => ['PENDING', 'IN_CYCLE', 'AWAITING_WARDEN'].includes(r.status));
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {stu?.rollNumber} · {stu?.branch} Year {stu?.year} ·{' '}
            {stu?.acEligible ? (<span className="text-sky-600 dark:text-sky-400 font-semibold">AC Eligible</span>) : (<span className="text-amber-600 dark:text-amber-400 font-semibold">
                Non-AC Allocation Only
              </span>)}
          </p>
        </div>
        <Link href="/exchange/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm">
          <PlusCircle className="w-4 h-4"/> New Exchange Request
        </Link>
      </div>

      {stu?.isRestricted && (<div className="rounded-2xl p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-800 dark:text-rose-200 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0"/>
          <span>
            Your account currently has an administrative restriction on room swaps. Contact the
            Hostel Office.
          </span>
        </div>)}

      {activeMatch && (<div className="rounded-2xl p-5 bg-gradient-to-r from-indigo-600 to-teal-600 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 shrink-0">
              <Sparkles className="w-6 h-6"/>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-100">
                Active Swap Cycle · {activeMatch.cycleCode}
              </p>
              <h2 className="text-lg font-extrabold mt-0.5">
                {activeMatch.length}-Party Circular Swap Detected!
              </h2>
              <p className="text-xs text-indigo-100 mt-1">
                Status: {activeMatch.status.replace(/_/g, ' ')} — Room allocations remain
                unchanged until Warden approves.
              </p>
            </div>
          </div>
          <Link href="/swap-matches" className="px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-xs hover:bg-indigo-50 shrink-0 text-center">
            View Circular Diagram →
          </Link>
        </div>)}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase">Current Room</span>
            {room && <RoomTypeBadge type={room.type}/>}
          </div>
          {room ? (<>
              <p className="text-2xl font-extrabold">
                Room {room.roomNumber}{' '}
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  ({stu?.currentBed?.bedLabel})
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {room.hostel.name} · {room.block.name} · Floor {room.floor}
              </p>
              <Link href="/my-room" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-3 hover:underline">
                <BedDouble className="w-3.5 h-3.5"/> View Roommates & Beds →
              </Link>
            </>) : (<p className="text-sm text-slate-500">No room currently assigned.</p>)}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Request</span>
            <GitCommitHorizontal className="w-4 h-4 text-indigo-500"/>
          </div>
          {activeRequest ? (<>
              <div className="flex items-center gap-2">
                <p className="text-xl font-extrabold">{activeRequest.requestCode}</p>
                <StatusBadge status={activeRequest.status}/>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                Target:{' '}
                {activeRequest.desiredRoom
                ? `Room ${activeRequest.desiredRoom.roomNumber}`
                : `Any ${activeRequest.desiredRoomType} room`}
              </p>
              <Link href="/my-requests" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-3 hover:underline">
                Track Timeline →
              </Link>
            </>) : (<>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">
                No Active Request
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Submit a room exchange request to join the swap graph.
              </p>
            </>)}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase">Semester Quota</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500"/>
          </div>
          <p className="text-2xl font-extrabold">
            {stu?.swapsThisSemester ?? 0}{' '}
            <span className="text-sm font-normal text-slate-500">completed swaps</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {matches.length} total cycle match(es) recorded
          </p>
          <Link href="/swap-matches" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-3 hover:underline">
            <ArrowLeftRight className="w-3.5 h-3.5"/> Open Swap Matches →
          </Link>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600"/> Recent Notifications
          </h3>
          <Link href="/notifications" className="text-xs font-semibold text-indigo-600 hover:underline">
            View All →
          </Link>
        </div>
        {notifications.length === 0 ? (<p className="text-xs text-slate-500">No notifications yet.</p>) : (<div className="space-y-2.5">
            {notifications.map((n) => (<div key={n.id} className={`p-3 rounded-xl border text-xs ${n.isRead
                    ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800'
                    : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900'}`}>
                <p className="font-bold">{n.title}</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
              </div>))}
          </div>)}
      </div>
    </div>);
}
export default function DashboardPage() {
    return (<AppShell roles={['STUDENT']}>
      <DashboardContent />
    </AppShell>);
}
