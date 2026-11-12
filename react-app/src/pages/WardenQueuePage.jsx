import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, ShieldCheck, XCircle } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingSpinner, Modal, } from '../components/StateDisplays';
import { StatusBadge } from '../components/StatusBadge';
import { SwapGraph } from '../components/SwapGraph';
import { useToast } from '../context/ToastContext';
export function WardenQueuePage() {
    const { showToast } = useToast();
    const [pendingQueue, setPendingQueue] = useState([]);
    const [recentDecisions, setRecentDecisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalAction, setModalAction] = useState(null);
    const [remarks, setRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const loadQueue = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/warden/queue');
            setPendingQueue(res.data.data.pendingQueue || []);
            setRecentDecisions(res.data.data.recentDecisions || []);
        }
        catch (err) {
            setError(getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadQueue();
    }, []);
    const executeDecision = async () => {
        if (!modalAction)
            return;
        if (modalAction.mode === 'REJECT' && remarks.trim().length < 3) {
            showToast('error', 'Remarks Required', 'Please provide a rejection reason.');
            return;
        }
        setSubmitting(true);
        try {
            const endpoint = modalAction.mode === 'APPROVE'
                ? `/warden/swaps/${modalAction.group.id}/approve`
                : `/warden/swaps/${modalAction.group.id}/reject`;
            await apiClient.post(endpoint, { remarks });
            showToast('success', modalAction.mode === 'APPROVE' ? 'Atomic Swap Executed!' : 'Swap Rejected', modalAction.mode === 'APPROVE'
                ? `All ${modalAction.group.length} room and bed records updated atomically.`
                : `Cycle ${modalAction.group.cycleCode} rejected; rooms untouched.`);
            setModalAction(null);
            setRemarks('');
            loadQueue();
        }
        catch (err) {
            showToast('error', 'Action Failed', getApiErrorMessage(err));
        }
        finally {
            setSubmitting(false);
        }
    };
    if (loading)
        return <LoadingSpinner label="Loading Warden Approval Queue..."/>;
    if (error)
        return <ErrorState message={error} onRetry={loadQueue}/>;
    return (<div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-indigo-600"/> Warden Approval Queue
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Review swap chains where all students have accepted. Approval updates all beds inside one
          atomic PostgreSQL transaction.
        </p>
      </div>

      {pendingQueue.length === 0 ? (<EmptyState title="Approval Queue Clear" description="There are no swap cycles awaiting warden review right now."/>) : (<div className="space-y-6">
          {pendingQueue.map((group) => (<div key={group.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-card space-y-5">
              <SwapGraph group={group}/>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  <ShieldCheck className="w-4 h-4"/>
                  All {group.length} participants accepted · Ready for atomic execution
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => {
                    setModalAction({ group, mode: 'REJECT' });
                    setRemarks('');
                }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100">
                    <XCircle className="w-4 h-4"/> Reject Swap
                  </button>
                  <button onClick={() => {
                    setModalAction({ group, mode: 'APPROVE' });
                    setRemarks('Verified eligibility and approved.');
                }} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm">
                    <CheckCircle2 className="w-4 h-4"/> Approve & Execute Swap
                  </button>
                </div>
              </div>
            </div>))}
        </div>)}

      {/* Recent Decisions */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-card">
        <h2 className="text-base font-bold mb-4">Recent Warden Decisions</h2>
        {recentDecisions.length === 0 ? (<p className="text-xs text-slate-500">No historical decisions recorded yet.</p>) : (<div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 pr-4">Cycle</th>
                  <th className="py-2.5 pr-4">Participants</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentDecisions.map((g) => (<tr key={g.id}>
                    <td className="py-3 pr-4 font-mono font-bold">{g.cycleCode}</td>
                    <td className="py-3 pr-4">
                      {g.participants
                    .map((p) => `${p.student.user.name} (${p.fromRoom.roomNumber}→${p.toRoom.roomNumber})`)
                    .join(', ')}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={g.status}/>
                    </td>
                    <td className="py-3 text-slate-500">
                      {g.approvals?.[0]?.remarks || g.dissolveReason || '—'}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>

      <Modal open={Boolean(modalAction)} onClose={() => setModalAction(null)} title={modalAction?.mode === 'APPROVE'
            ? `Execute Atomic Swap · ${modalAction?.group.cycleCode}`
            : `Reject Swap · ${modalAction?.group.cycleCode}`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {modalAction?.mode === 'APPROVE'
            ? 'This will atomically move all participating students to their destination rooms and beds inside a single PostgreSQL transaction and notify all participants.'
            : 'All room allocations will remain untouched and participants will be notified.'}
          </p>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Warden Remarks {modalAction?.mode === 'REJECT' ? '(Required)' : '(Optional)'}
            </label>
            <textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"/>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalAction(null)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700">
              Cancel
            </button>
            <button disabled={submitting} onClick={executeDecision} className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${modalAction?.mode === 'APPROVE'
            ? 'bg-emerald-600 hover:bg-emerald-700'
            : 'bg-rose-600 hover:bg-rose-700'}`}>
              {submitting ? 'Processing...' : 'Confirm Decision'}
            </button>
          </div>
        </div>
      </Modal>
    </div>);
}
