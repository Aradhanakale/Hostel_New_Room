'use client';
import { useEffect, useState } from 'react';
import { Bell, CheckCheck, Mail } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { EmptyState, ErrorState, LoadingSpinner } from '@/components/StateDisplays';
import { useToast } from '@/context/Providers';
import { apiClient, getApiErrorMessage } from '@/lib/apiClient';
function NotificationsContent() {
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [emailStubs, setEmailStubs] = useState([]);
    const [tab, setTab] = useState('inapp');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [nRes, eRes] = await Promise.all([
                apiClient.get('/notifications'),
                apiClient.get('/notifications/email-stubs'),
            ]);
            setNotifications(nRes.data.data.notifications || []);
            setEmailStubs(eRes.data.data || []);
        }
        catch (err) {
            setError(getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadAll();
    }, []);
    const markRead = async (id) => {
        try {
            await apiClient.patch(`/notifications/${id}/read`);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        }
        catch (err) {
            showToast('error', 'Failed', getApiErrorMessage(err));
        }
    };
    const markAllRead = async () => {
        try {
            await apiClient.post('/notifications/read-all');
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            showToast('success', 'All caught up', 'All notifications marked as read.');
        }
        catch (err) {
            showToast('error', 'Failed', getApiErrorMessage(err));
        }
    };
    if (loading)
        return <LoadingSpinner label="Loading notifications..."/>;
    if (error)
        return <ErrorState message={error} onRetry={loadAll}/>;
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            In-app alerts and simulated SMTP email dispatches.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button onClick={() => setTab('inapp')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'inapp' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600' : ''}`}>
              In-App ({notifications.length})
            </button>
            <button onClick={() => setTab('emails')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${tab === 'emails' ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600' : ''}`}>
              Email Stub Log ({emailStubs.length})
            </button>
          </div>
          {tab === 'inapp' && (<button onClick={markAllRead} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">
              <CheckCheck className="w-4 h-4 text-emerald-600"/> Mark All Read
            </button>)}
        </div>
      </div>

      {tab === 'inapp' ? (notifications.length === 0 ? (<EmptyState title="No Notifications" description="Swap matches, acceptance prompts, and warden decisions will appear here."/>) : (<div className="space-y-3">
            {notifications.map((n) => (<div key={n.id} onClick={() => !n.isRead && markRead(n.id)} className={`rounded-2xl p-4 border transition-colors cursor-pointer ${n.isRead
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    : 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Bell className={`w-5 h-5 shrink-0 mt-0.5 ${n.isRead ? 'text-slate-400' : 'text-indigo-600'}`}/>
                    <div>
                      <p className="text-sm font-bold">{n.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {new Date(n.createdAt).toLocaleString()} · Email stub sent to{' '}
                        {n.emailStubRecipient}
                      </p>
                    </div>
                  </div>
                  {!n.isRead && (<span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0 mt-1.5"/>)}
                </div>
              </div>))}
          </div>)) : emailStubs.length === 0 ? (<EmptyState title="No Outgoing Emails Yet" description="Email stubs generated during this server session appear here."/>) : (<div className="space-y-3">
          {emailStubs.map((e, idx) => (<div key={idx} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold flex items-center gap-1.5 text-indigo-600">
                  <Mail className="w-4 h-4"/> To: {e.to}
                </span>
                <span className="text-slate-400">{new Date(e.sentAt).toLocaleTimeString()}</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-white">{e.subject}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-1">{e.body}</p>
            </div>))}
        </div>)}
    </div>);
}
export default function NotificationsPage() {
    return (<AppShell>
      <NotificationsContent />
    </AppShell>);
}
