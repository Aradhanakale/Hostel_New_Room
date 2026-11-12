import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Plus, RefreshCw, Settings2, Shield, Upload, Users, } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../api/client';
import { RoomTypeBadge } from '../components/RoomTypeBadge';
import { ErrorState, LoadingSpinner, Modal } from '../components/StateDisplays';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
export function AdminDashboardPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const isAdmin = user?.role === 'ADMIN';
    const [tab, setTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [cycles, setCycles] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [hostels, setHostels] = useState([]);
    const [students, setStudents] = useState([]);
    const [policies, setPolicies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Modals
    const [roomModalOpen, setRoomModalOpen] = useState(false);
    const [csvModal, setCsvModal] = useState(null);
    const [csvText, setCsvText] = useState('');
    // Create room fields
    const [newRoom, setNewRoom] = useState({
        hostelId: '',
        blockId: '',
        roomNumber: '',
        floor: 1,
        bedCount: 2,
        type: 'AC',
        gender: 'MALE',
    });
    const loadAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [sRes, swRes, rRes, hRes, stRes, pRes] = await Promise.all([
                apiClient.get('/admin/stats'),
                apiClient.get('/admin/swaps'),
                apiClient.get('/rooms'),
                apiClient.get('/hostels'),
                apiClient.get('/admin/students'),
                apiClient.get('/admin/policies'),
            ]);
            setStats(sRes.data.data);
            setCycles(swRes.data.data.cycles || []);
            setRooms(rRes.data.data || []);
            const hList = hRes.data.data || [];
            setHostels(hList);
            if (hList.length > 0 && !newRoom.hostelId) {
                setNewRoom((prev) => ({
                    ...prev,
                    hostelId: hList[0].id,
                    blockId: hList[0].blocks?.[0]?.id || '',
                }));
            }
            setStudents(stRes.data.data || []);
            setPolicies(pRes.data.data || []);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePolicyToggle = async (policy, field, value) => {
        try {
            const res = await apiClient.patch(`/admin/policies/${policy.id}`, { [field]: value });
            setPolicies((prev) => prev.map((p) => (p.id === policy.id ? res.data.data : p)));
            showToast('success', 'Policy Updated', `${String(field)} updated live.`);
        }
        catch (err) {
            showToast('error', 'Update Failed', getApiErrorMessage(err));
        }
    };
    const handleCreateRoom = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/admin/rooms', newRoom);
            showToast('success', 'Room Created', `Room ${newRoom.roomNumber} added.`);
            setRoomModalOpen(false);
            loadAll();
        }
        catch (err) {
            showToast('error', 'Creation Failed', getApiErrorMessage(err));
        }
    };
    const handleRoomEdit = async (roomId, patch) => {
        try {
            await apiClient.patch(`/admin/rooms/${roomId}`, patch);
            showToast('success', 'Room Updated');
            loadAll();
        }
        catch (err) {
            showToast('error', 'Update Blocked', getApiErrorMessage(err));
        }
    };
    const handleStudentToggle = async (studentId, patch) => {
        try {
            await apiClient.patch(`/admin/students/${studentId}`, patch);
            showToast('success', 'Student Updated');
            loadAll();
        }
        catch (err) {
            showToast('error', 'Update Failed', getApiErrorMessage(err));
        }
    };
    const handleCsvImport = async () => {
        if (!csvModal)
            return;
        try {
            const res = await apiClient.post(`/admin/import/${csvModal}`, { csv: csvText });
            const { created, errors } = res.data.data;
            showToast('success', `Imported ${created} ${csvModal}`, errors.length ? `${errors.length} row errors skipped.` : 'All rows imported cleanly.');
            setCsvModal(null);
            setCsvText('');
            loadAll();
        }
        catch (err) {
            showToast('error', 'Import Failed', getApiErrorMessage(err));
        }
    };
    const runCycleDetector = async () => {
        try {
            const res = await apiClient.post('/swaps/detect');
            showToast('info', 'Cycle Detection Finished', `${res.data.data.cyclesCreated} new swap cycle(s) created.`);
            loadAll();
        }
        catch (err) {
            showToast('error', 'Failed', getApiErrorMessage(err));
        }
    };
    if (loading)
        return <LoadingSpinner label="Loading Admin Console..."/>;
    if (error || !stats)
        return <ErrorState message={error || 'No stats'} onRetry={loadAll}/>;
    const selectedHostelObj = hostels.find((h) => h.id === newRoom.hostelId);
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600"/> Admin Control Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Campus occupancy analytics, room/student bulk management, and live swap policy rules.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={runCycleDetector} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700">
            <RefreshCw className="w-3.5 h-3.5"/> Run Cycle Engine
          </button>
          {isAdmin && (<>
              <button onClick={() => {
                setCsvModal('rooms');
                setCsvText('hostelCode,blockCode,roomNumber,floor,bedCount,type,gender\nABH,A,A-401,4,2,AC,MALE');
            }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
                <Upload className="w-3.5 h-3.5"/> Import Rooms CSV
              </button>
              <button onClick={() => {
                setCsvModal('students');
                setCsvText('name,email,rollNumber,year,gender,branch,acEligible\nRaghav Sen,raghav.new@hostel.edu,CS202699,2,MALE,CSE,true');
            }} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800">
                <Upload className="w-3.5 h-3.5"/> Import Students CSV
              </button>
            </>)}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <p className="text-xs font-semibold text-slate-500">Pending Requests</p>
          <p className="text-3xl font-extrabold mt-1 text-amber-600">{stats.requests.pending}</p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.requests.inCycle} locked in active cycles
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <p className="text-xs font-semibold text-slate-500">Completed Swaps</p>
          <p className="text-3xl font-extrabold mt-1 text-emerald-600">
            {stats.requests.completed}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.cycles.completed} cycles executed atomically
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <p className="text-xs font-semibold text-slate-500">Swap Success Rate</p>
          <p className="text-3xl font-extrabold mt-1 text-indigo-600">
            {stats.requests.successRate}%
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.cycles.awaitingWarden} awaiting warden approval
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <p className="text-xs font-semibold text-slate-500">Campus Occupancy</p>
          <p className="text-3xl font-extrabold mt-1">{stats.occupancy.occupancyRate}%</p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.occupancy.occupiedBeds}/{stats.occupancy.totalBeds} beds filled
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
            { id: 'overview', label: 'Analytics & Cycles', icon: CheckCircle2 },
            { id: 'rooms', label: `Rooms (${rooms.length})`, icon: Building2 },
            { id: 'students', label: `Students (${students.length})`, icon: Users },
            { id: 'policies', label: 'Policy Engine', icon: Settings2 },
        ].map((t) => {
            const Icon = t.icon;
            return (<button key={t.id} onClick={() => setTab(t.id)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${tab === t.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4"/> {t.label}
            </button>);
        })}
      </div>

      {tab === 'overview' && (<div className="space-y-6">
          {/* Occupancy Breakdown Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card space-y-4">
              <h3 className="text-sm font-bold">Occupancy by Room Type (AC vs Non-AC)</h3>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>AC Rooms ({stats.occupancy.ac.occupied}/{stats.occupancy.ac.total} beds)</span>
                  <span>{stats.occupancy.ac.rate}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${stats.occupancy.ac.rate}%` }}/>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>
                    Non-AC Rooms ({stats.occupancy.nonAc.occupied}/{stats.occupancy.nonAc.total} beds)
                  </span>
                  <span>{stats.occupancy.nonAc.rate}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${stats.occupancy.nonAc.rate}%` }}/>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card space-y-3">
              <h3 className="text-sm font-bold">Occupancy by Bed Configuration</h3>
              {Object.entries(stats.occupancy.byBedCount).map(([label, d]) => {
                const pct = d.total > 0 ? Math.round((d.occupied / d.total) * 100) : 0;
                return (<div key={label}>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span>
                        {label} ({d.rooms} rooms)
                      </span>
                      <span>
                        {d.occupied}/{d.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>);
            })}
            </div>
          </div>

          {/* All Cycles Table */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
            <h3 className="text-sm font-bold mb-4">All Detected Swap Cycles ({cycles.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-2 pr-4">Cycle</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Participants Chain</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {cycles.map((c) => (<tr key={c.id}>
                      <td className="py-3 pr-4 font-mono font-bold">{c.cycleCode}</td>
                      <td className="py-3 pr-4">
                        {c.type} ({c.length})
                      </td>
                      <td className="py-3 pr-4">
                        {c.participants
                    .map((p) => `${p.student.user.name} (${p.fromRoom.roomNumber})`)
                    .join(' → ')}
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge status={c.status}/>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        </div>)}

      {tab === 'rooms' && (<div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Campus Rooms & Bed Configurations</h3>
            {isAdmin && (<button onClick={() => setRoomModalOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                <Plus className="w-4 h-4"/> Add Room
              </button>)}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 pr-4">Room</th>
                  <th className="py-2.5 pr-4">Hostel / Block</th>
                  <th className="py-2.5 pr-4">Type</th>
                  <th className="py-2.5 pr-4">Beds</th>
                  <th className="py-2.5 pr-4">Occupancy</th>
                  <th className="py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rooms.map((r) => (<tr key={r.id}>
                    <td className="py-3 pr-4 font-bold">{r.roomNumber}</td>
                    <td className="py-3 pr-4">
                      {r.hostel.code} · {r.block.name} (Fl {r.floor})
                    </td>
                    <td className="py-3 pr-4">
                      {isAdmin ? (<button onClick={() => handleRoomEdit(r.id, { type: r.type === 'AC' ? 'NON_AC' : 'AC' })} title="Click to toggle AC / Non-AC">
                          <RoomTypeBadge type={r.type}/>
                        </button>) : (<RoomTypeBadge type={r.type}/>)}
                    </td>
                    <td className="py-3 pr-4">{r.bedCount}-Bed</td>
                    <td className="py-3 pr-4">
                      {r.occupiedCount}/{r.bedCount} ({r.availableCount} free)
                    </td>
                    <td className="py-3">
                      {isAdmin ? (<select value={r.status} onChange={(e) => handleRoomEdit(r.id, { status: e.target.value })} className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
                          <option value="AVAILABLE">AVAILABLE</option>
                          <option value="FULL">FULL</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                        </select>) : (r.status)}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}

      {tab === 'students' && (<div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
          <h3 className="text-sm font-bold mb-4">Student Directory & Eligibility Controls</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 pr-4">Roll #</th>
                  <th className="py-2.5 pr-4">Name & Email</th>
                  <th className="py-2.5 pr-4">Batch</th>
                  <th className="py-2.5 pr-4">Current Room</th>
                  <th className="py-2.5 pr-4">AC Eligible</th>
                  <th className="py-2.5">Restricted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((s) => (<tr key={s.id}>
                    <td className="py-2.5 pr-4 font-mono font-bold">{s.rollNumber}</td>
                    <td className="py-2.5 pr-4">
                      <span className="font-semibold block">{s.user.name}</span>
                      <span className="text-slate-400">{s.user.email}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {s.branch} Yr {s.year} ({s.gender})
                    </td>
                    <td className="py-2.5 pr-4">
                      {s.bed
                    ? `${s.bed.room.roomNumber} (${s.bed.bedLabel}) · ${s.bed.room.type}`
                    : 'Unassigned'}
                    </td>
                    <td className="py-2.5 pr-4">
                      <button disabled={!isAdmin} onClick={() => handleStudentToggle(s.id, { acEligible: !s.acEligible })} className={`px-2.5 py-1 rounded-full font-bold ${s.acEligible
                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {s.acEligible ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td className="py-2.5">
                      <button disabled={!isAdmin} onClick={() => handleStudentToggle(s.id, { isRestricted: !s.isRestricted })} className={`px-2.5 py-1 rounded-full font-bold ${s.isRestricted
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                        {s.isRestricted ? 'Restricted' : 'Active'}
                      </button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}

      {tab === 'policies' && (<div className="space-y-4">
          {policies.map((p) => (<div key={p.id} className="rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-card space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">{p.name}</h3>
                  <p className="text-xs text-slate-500">
                    Last updated by {p.updatedBy || 'System'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {[
                    { key: 'sameGenderOnly', label: 'Enforce Same-Gender Block' },
                    { key: 'sameYearOnly', label: 'Enforce Same Year / Batch' },
                    { key: 'allowAcNonAcSwap', label: 'Allow AC ↔ Non-AC Cross Swaps' },
                    { key: 'requireAcEligibility', label: 'Require AC Fee Eligibility for AC' },
                    { key: 'requireSameBedCount', label: 'Require Matching Bed Count' },
                ].map((item) => {
                    const checked = Boolean(p[item.key]);
                    return (<label key={item.key} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
                      <span className="font-semibold">{item.label}</span>
                      <input type="checkbox" disabled={!isAdmin} checked={checked} onChange={(e) => handlePolicyToggle(p, item.key, e.target.checked)} className="w-4 h-4 text-indigo-600 rounded"/>
                    </label>);
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
                {[
                    { key: 'maxSwapsPerSemester', label: 'Max Swaps / Semester' },
                    { key: 'cooldownDays', label: 'Cooldown (Days)' },
                    { key: 'maxCycleLength', label: 'Max Cycle Length (2-8)' },
                    { key: 'acceptanceTimeoutHours', label: 'Acceptance Timeout (Hrs)' },
                ].map((numField) => (<div key={numField.key}>
                    <label className="block font-semibold text-slate-500 mb-1">
                      {numField.label}
                    </label>
                    <input type="number" disabled={!isAdmin} defaultValue={Number(p[numField.key])} onBlur={(e) => handlePolicyToggle(p, numField.key, Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold"/>
                  </div>))}
              </div>
            </div>))}
        </div>)}

      {/* Create Room Modal */}
      <Modal open={roomModalOpen} onClose={() => setRoomModalOpen(false)} title="Add New Hostel Room">
        <form onSubmit={handleCreateRoom} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold mb-1">Hostel</label>
            <select value={newRoom.hostelId} onChange={(e) => {
            const h = hostels.find((item) => item.id === e.target.value);
            setNewRoom({
                ...newRoom,
                hostelId: e.target.value,
                blockId: h?.blocks?.[0]?.id || '',
            });
        }} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {hostels.map((h) => (<option key={h.id} value={h.id}>
                  {h.name}
                </option>))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Block</label>
            <select value={newRoom.blockId} onChange={(e) => setNewRoom({ ...newRoom, blockId: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {(selectedHostelObj?.blocks || []).map((b) => (<option key={b.id} value={b.id}>
                  {b.name}
                </option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Room Number</label>
              <input required placeholder="A-405" value={newRoom.roomNumber} onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"/>
            </div>
            <div>
              <label className="block font-semibold mb-1">Floor</label>
              <input type="number" min={0} max={20} value={newRoom.floor} onChange={(e) => setNewRoom({ ...newRoom, floor: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"/>
            </div>
            <div>
              <label className="block font-semibold mb-1">Bed Count</label>
              <select value={newRoom.bedCount} onChange={(e) => setNewRoom({ ...newRoom, bedCount: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                {[1, 2, 3, 4, 6].map((n) => (<option key={n} value={n}>
                    {n}-Bed
                  </option>))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Room Type</label>
              <select value={newRoom.type} onChange={(e) => setNewRoom({ ...newRoom, type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <option value="AC">AC</option>
                <option value="NON_AC">Non-AC</option>
              </select>
            </div>
          </div>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold">
            Create Room
          </button>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal open={Boolean(csvModal)} onClose={() => setCsvModal(null)} title={`Bulk CSV Import (${csvModal === 'rooms' ? 'Rooms' : 'Students'})`}>
        <div className="space-y-4 text-xs">
          <p className="text-slate-500">
            Paste CSV rows below (with header line). Valid rows will be inserted into PostgreSQL.
          </p>
          <textarea rows={7} value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"/>
          <div className="flex justify-end gap-2">
            <button onClick={() => setCsvModal(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold">
              Cancel
            </button>
            <button onClick={handleCsvImport} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">
              Run Import
            </button>
          </div>
        </div>
      </Modal>
    </div>);
}
