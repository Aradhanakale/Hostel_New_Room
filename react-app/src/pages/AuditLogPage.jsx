import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../api/client';
import { EmptyState, ErrorState, LoadingSpinner } from '../components/StateDisplays';
import { useToast } from '../context/ToastContext';
export function AuditLogPage() {
    const { showToast } = useToast();
    const [logs, setLogs] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const loadLogs = async (query = search) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get('/audit-logs', {
                params: query ? { search: query } : undefined,
            });
            setLogs(res.data.data.logs || []);
        }
        catch (err) {
            setError(getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleExport = async (format) => {
        try {
            const res = await apiClient.get(`/audit-logs/export?format=${format}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit-trail.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showToast('success', `Exported ${format.toUpperCase()}`, 'Audit trail downloaded.');
        }
        catch (err) {
            showToast('error', 'Export Failed', getApiErrorMessage(err));
        }
    };
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600"/> Immutable Audit Trail
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Append-only log of all room allocations, swap cycles, policy edits, and approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => handleExport('csv')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold hover:bg-slate-50">
            <Download className="w-4 h-4 text-emerald-600"/> Export CSV
          </button>
          <button onClick={() => handleExport('pdf')} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
            <FileText className="w-4 h-4"/> Export PDF
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3"/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadLogs(search)} placeholder="Search actor email, action, or entity ID..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"/>
        </div>
        <button onClick={() => loadLogs(search)} className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold">
          Filter
        </button>
      </div>

      {loading ? (<LoadingSpinner label="Loading audit trail..."/>) : error ? (<ErrorState message={error} onRetry={() => loadLogs()}/>) : logs.length === 0 ? (<EmptyState title="No Audit Entries" description="No logs matched your filter criteria."/>) : (<div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Old → New State</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (<tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold block">{log.actorEmail}</span>
                      <span className="text-[10px] uppercase text-indigo-600 dark:text-indigo-400 font-bold">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {log.action}
                    </td>
                    <td className="py-3 px-4">
                      {log.entityType}: <span className="font-mono font-semibold">{log.entityId}</span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-mono text-[11px] text-slate-500">
                      {log.oldValue ? JSON.stringify(log.oldValue) : '—'} →{' '}
                      {log.newValue ? JSON.stringify(log.newValue) : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {log.remarks || '—'}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
}
