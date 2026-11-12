'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { EmptyState, ErrorState, LoadingSpinner, Modal, } from '@/components/StateDisplays';
import { SwapGraph } from '@/components/SwapGraph';
import { useAuth, useToast } from '@/context/Providers';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';
function SwapMatchesContent() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectRemarks, setRejectRemarks] = useState('');
    const loadMatches = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/swaps/matches');
            setGroups(res.data.data || []);
        }
        catch (err) {
            setError(getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadMatches();
    }, []);
    const handleDetect = async () => {
        setBusyId('detect');
        try {
            const res = await apiClient.post('/swaps/detect');
            showToast('info', 'Cycle Detection Complete', `${res.data.data.cyclesCreated} new swap cycle(s) formed.`);
            loadMatches();
        }
        catch (err) {
            showToast('error', 'Detection Failed', getApiErrorMessage(err));
        }
        finally {
            setBusyId(null);
        }
    };
    const handleRespond = async (groupId, decision, remarks) => {
        setBusyId(groupId);
        try {
            const res = await apiClient.post(`/swaps/${groupId}/respond`, { decision, remarks });
            if (decision === 'ACCEPTED') {
                showToast('success', 'Swap Accepted!', res.data.data.allAccepted
                    ? 'All participants accepted! Forwarded to Warden Approval Queue.'
                    : 'Your acceptance is recorded. Waiting for other participants.');
            }
            else {
                showToast('info', 'Swap Declined', 'The cycle was dissolved and other participants returned to the pool.');
            }
            setRejectTarget(null);
            setRejectRemarks('');
            loadMatches();
        }
        catch (err) {
            showToast('error', 'Action Failed', getApiErrorMessage(err));
        }
        finally {
            setBusyId(null);
        }
    };
    if (loading)
        return <LoadingSpinner label="Loading circular swap matches..."/>;
    if (error)
        return <ErrorState message={error} onRetry={loadMatches}/>;
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Swap Matches & Cycles</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Interactive circular swap chains detected from active requests.
          </p>
        </div>

        <button onClick={handleDetect} disabled={busyId === 'detect'} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100">
          <RefreshCw className={`w-4 h-4 ${busyId === 'detect' ? 'animate-spin' : ''}`}/>
          Run Cycle Detector
        </button>
      </div>

      <div className="rounded-2xl p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600"/>
        <span>
          <strong>Atomicity Guarantee:</strong> Accepting a cycle locks your intention, but room
          and bed allocations <strong>never change</strong> until all participants accept AND the
          Warden approves the transaction.
        </span>
      </div>

      {groups.length === 0 ? (<EmptyState title="No Swap Cycles Yet" description="Once your request forms a 2-way or multi-party cycle (A→B→C→A) with compatible peers, the interactive circular graph appears here."/>) : (<div className="space-y-6">
          {groups.map((group) => {
                const myParticipant = group.participants.find((p) => p.student.user.id === user?.id);
                const canRespond = group.status === 'AWAITING_ACCEPTANCE' &&
                    myParticipant &&
                    myParticipant.decision === 'PENDING';
                return (<div key={group.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-card space-y-5">
                <SwapGraph group={group} currentUserId={user?.id}/>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-4 h-4"/>
                    <span>
                      Acceptance deadline:{' '}
                      <strong>{new Date(group.acceptanceDeadline).toLocaleString()}</strong>
                    </span>
                  </div>

                  {canRespond && (<div className="flex items-center gap-3">
                      <button disabled={busyId === group.id} onClick={() => setRejectTarget(group)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100">
                        <XCircle className="w-4 h-4"/> Decline Swap
                      </button>
                      <button disabled={busyId === group.id} onClick={() => handleRespond(group.id, 'ACCEPTED')} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm">
                        <CheckCircle2 className="w-4 h-4"/> Accept Swap
                      </button>
                    </div>)}

                  {group.dissolveReason && (<p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                      {group.dissolveReason}
                    </p>)}
                </div>
              </div>);
            })}
        </div>)}

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title={`Decline Swap Cycle ${rejectTarget?.cycleCode}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Declining dissolves this cycle and releases all other participants back into the active
            matching pool.
          </p>
          <textarea rows={3} value={rejectRemarks} onChange={(e) => setRejectRemarks(e.target.value)} placeholder="Optional reason for declining..." className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"/>
          <div className="flex justify-end gap-2">
            <button onClick={() => setRejectTarget(null)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700">
              Back
            </button>
            <button onClick={() => rejectTarget && handleRespond(rejectTarget.id, 'REJECTED', rejectRemarks)} className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700">
              Confirm Decline
            </button>
          </div>
        </div>
      </Modal>
    </div>);
}
export default function SwapMatchesPage() {
    return (<AppShell roles={['STUDENT']}>
      <SwapMatchesContent />
    </AppShell>);
}
