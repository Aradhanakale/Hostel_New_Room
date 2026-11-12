import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PlusCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../api/client';
import { RoomTypeBadge } from '../components/RoomTypeBadge';
import { EmptyState, ErrorState, LoadingSpinner, Modal, } from '../components/StateDisplays';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { ValidationChecklist } from '../components/ValidationChecklist';
import { useToast } from '../context/ToastContext';
export function MyRequestsPage() {
    const { showToast } = useToast();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedForChecks, setSelectedForChecks] = useState(null);
    const loadRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/exchanges');
            setRequests(res.data.data || []);
        }
        catch (err) {
            setError(getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadRequests();
    }, []);
    const handleCancel = async (id, code) => {
        try {
            await apiClient.post(`/exchanges/${id}/cancel`);
            showToast('info', 'Request Cancelled', `${code} has been cancelled.`);
            loadRequests();
        }
        catch (err) {
            showToast('error', 'Cancel Failed', getApiErrorMessage(err));
        }
    };
    if (loading)
        return <LoadingSpinner label="Loading your exchange requests..."/>;
    if (error)
        return <ErrorState message={error} onRetry={loadRequests}/>;
    return (<div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Exchange Requests</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track live validation, cycle matching, and warden approval status.
          </p>
        </div>
        <Link to="/exchange/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
          <PlusCircle className="w-4 h-4"/> New Request
        </Link>
      </div>

      {requests.length === 0 ? (<EmptyState title="No Exchange Requests Yet" description="You have not submitted any room exchange requests this semester." action={<Link to="/exchange/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold">
              Create First Request
            </Link>}/>) : (<div className="space-y-4">
          {requests.map((req) => (<div key={req.id} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-base font-extrabold font-mono">{req.requestCode}</span>
                  <StatusBadge status={req.status}/>
                  <RoomTypeBadge type={req.desiredRoom ? req.desiredRoom.type : req.desiredRoomType}/>
                </div>
                <div className="flex items-center gap-2">
                  {req.validationSnapshot && (<button onClick={() => setSelectedForChecks(req)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600"/> Policy Checks
                    </button>)}
                  {['PENDING', 'IN_CYCLE'].includes(req.status) && (<button onClick={() => handleCancel(req.id, req.requestCode)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:bg-rose-100">
                      <Trash2 className="w-3.5 h-3.5"/> Cancel
                    </button>)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl">
                <div>
                  <span className="text-slate-500 block">From Current Room</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Room {req.currentRoom.roomNumber} ({req.currentBed.bedLabel}) ·{' '}
                    {req.currentRoom.type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Desired Target</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {req.desiredRoom
                    ? `Room ${req.desiredRoom.roomNumber} (${req.desiredRoom.bedCount}-Bed)`
                    : `Any ${req.desiredRoomType} ${req.desiredBedCount ? `${req.desiredBedCount}-Bed` : ''}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Expires</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5"/>
                    {new Date(req.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Reason:</span> {req.reason}
              </p>

              <Timeline status={req.status}/>

              {req.lockedCycle && (<div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    Matched in Cycle {req.lockedCycle.cycleCode} ({req.lockedCycle.length}-way)
                  </span>
                  <Link to="/swap-matches" className="font-bold text-indigo-600 hover:underline">
                    Open Swap Graph →
                  </Link>
                </div>)}
            </div>))}
        </div>)}

      <Modal open={Boolean(selectedForChecks)} onClose={() => setSelectedForChecks(null)} title={`Validation Snapshot · ${selectedForChecks?.requestCode}`}>
        <ValidationChecklist validation={selectedForChecks?.validationSnapshot || null}/>
      </Modal>
    </div>);
}
