import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Loader2, Send, Sparkles } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../api/client';
import { RoomCard } from '../components/RoomCard';
import { EmptyState, LoadingSpinner } from '../components/StateDisplays';
import { ValidationChecklist } from '../components/ValidationChecklist';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
export function RequestExchangePage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [hostels, setHostels] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    // Filters
    const [hostelId, setHostelId] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [bedCountFilter, setBedCountFilter] = useState('');
    const [floorFilter, setFloorFilter] = useState('');
    const [search, setSearch] = useState('');
    // Form state
    const [targetMode, setTargetMode] = useState('SPECIFIC');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [desiredRoomType, setDesiredRoomType] = useState('ANY');
    const [desiredBedCount, setDesiredBedCount] = useState('');
    const [reason, setReason] = useState('');
    const [expiresAt, setExpiresAt] = useState(() => {
        const d = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 10);
    });
    const [validation, setValidation] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        const fetchInitial = async () => {
            try {
                const [hRes, rRes] = await Promise.all([
                    apiClient.get('/hostels'),
                    apiClient.get('/rooms'),
                ]);
                setHostels(hRes.data.data || []);
                setRooms(rRes.data.data || []);
            }
            catch (err) {
                showToast('error', 'Failed to load rooms', getApiErrorMessage(err));
            }
            finally {
                setLoadingRooms(false);
            }
        };
        fetchInitial();
    }, [showToast]);
    // Run live policy validation preview whenever target changes
    useEffect(() => {
        const runPreview = async () => {
            try {
                const payload = targetMode === 'SPECIFIC'
                    ? {
                        desiredRoomId: selectedRoom?.id || null,
                        desiredRoomType: selectedRoom?.type || 'ANY',
                        expiresAt: new Date(expiresAt).toISOString(),
                    }
                    : {
                        desiredRoomId: null,
                        desiredRoomType,
                        desiredBedCount: desiredBedCount ? Number(desiredBedCount) : null,
                        expiresAt: new Date(expiresAt).toISOString(),
                    };
                const res = await apiClient.post('/exchanges/validate-preview', payload);
                setValidation(res.data.data);
            }
            catch {
                // ignore preview errors
            }
        };
        runPreview();
    }, [targetMode, selectedRoom, desiredRoomType, desiredBedCount, expiresAt]);
    const filteredRooms = rooms.filter((r) => {
        if (hostelId && r.hostel.id !== hostelId)
            return false;
        if (typeFilter !== 'ALL' && r.type !== typeFilter)
            return false;
        if (bedCountFilter && r.bedCount !== Number(bedCountFilter))
            return false;
        if (floorFilter && r.floor !== Number(floorFilter))
            return false;
        if (search && !r.roomNumber.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (targetMode === 'SPECIFIC' && !selectedRoom) {
            showToast('error', 'Select a room', 'Please click a target room card below.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                desiredRoomId: targetMode === 'SPECIFIC' ? selectedRoom?.id : null,
                desiredHostelId: targetMode === 'PREFERENCE' && hostelId ? hostelId : null,
                desiredRoomType: targetMode === 'SPECIFIC' && selectedRoom ? selectedRoom.type : desiredRoomType,
                desiredBedCount: targetMode === 'PREFERENCE' && desiredBedCount ? Number(desiredBedCount) : null,
                reason,
                expiresAt: new Date(`${expiresAt}T23:59:59Z`).toISOString(),
            };
            const res = await apiClient.post('/exchanges', payload);
            const { cyclesDetectedNow } = res.data.data;
            if (cyclesDetectedNow > 0) {
                showToast('success', 'Match Found Immediately!', 'A swap cycle was detected and locked. Check Swap Matches to accept.');
                navigate('/swap-matches');
            }
            else {
                showToast('success', 'Exchange Request Submitted', 'Added to active swap graph. You will be notified when a cycle forms.');
                navigate('/my-requests');
            }
        }
        catch (err) {
            showToast('error', 'Request Blocked by Policy', getApiErrorMessage(err));
        }
        finally {
            setSubmitting(false);
        }
    };
    const currentRoomId = user?.student?.currentRoom?.id;
    return (<div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Request Room Exchange</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a specific target room or general preferences. Policy rules validate in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Target Selector */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card">
            <div className="flex gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-5">
              <button type="button" onClick={() => setTargetMode('SPECIFIC')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${targetMode === 'SPECIFIC'
            ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
            : 'text-slate-600 dark:text-slate-400'}`}>
                Specific Room Target
              </button>
              <button type="button" onClick={() => setTargetMode('PREFERENCE')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${targetMode === 'PREFERENCE'
            ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
            : 'text-slate-600 dark:text-slate-400'}`}>
                Any Room Matching Criteria
              </button>
            </div>

            {targetMode === 'SPECIFIC' ? (<div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase">
                  <Filter className="w-3.5 h-3.5"/> Filter Rooms
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <input placeholder="Room # (e.g. A-205)" value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"/>
                  <select value={hostelId} onChange={(e) => setHostelId(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
                    <option value="">All Hostels</option>
                    {hostels.map((h) => (<option key={h.id} value={h.id}>
                        {h.code} - {h.name}
                      </option>))}
                  </select>
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
                    <option value="ALL">AC & Non-AC</option>
                    <option value="AC">AC Only</option>
                    <option value="NON_AC">Non-AC Only</option>
                  </select>
                  <select value={bedCountFilter} onChange={(e) => setBedCountFilter(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
                    <option value="">Any Beds</option>
                    {[1, 2, 3, 4, 6].map((n) => (<option key={n} value={n}>
                        {n}-Bed
                      </option>))}
                  </select>
                  <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs">
                    <option value="">Any Floor</option>
                    {[1, 2, 3, 4].map((f) => (<option key={f} value={f}>
                        Floor {f}
                      </option>))}
                  </select>
                </div>

                {loadingRooms ? (<LoadingSpinner label="Loading campus rooms..."/>) : filteredRooms.length === 0 ? (<EmptyState title="No rooms match filters" description="Try clearing your AC or bed count filters."/>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[540px] overflow-y-auto pr-1">
                    {filteredRooms.map((r) => (<RoomCard key={r.id} room={r} isCurrentRoom={r.id === currentRoomId} selected={selectedRoom?.id === r.id} onSelect={(rm) => setSelectedRoom(rm)}/>))}
                  </div>)}
              </div>) : (<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Preferred Hostel</label>
                  <select value={hostelId} onChange={(e) => setHostelId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                    <option value="">Any Eligible Hostel</option>
                    {hostels.map((h) => (<option key={h.id} value={h.id}>
                        {h.name}
                      </option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Room Type</label>
                  <select value={desiredRoomType} onChange={(e) => setDesiredRoomType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                    <option value="ANY">Any Type</option>
                    <option value="AC">AC Room</option>
                    <option value="NON_AC">Non-AC Room</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Bed Count</label>
                  <select value={desiredBedCount} onChange={(e) => setDesiredBedCount(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm">
                    <option value="">Any Capacity</option>
                    {[1, 2, 3, 4, 6].map((n) => (<option key={n} value={n}>
                        {n}-Bed Room
                      </option>))}
                  </select>
                </div>
              </div>)}
          </div>
        </div>

        {/* Right Column: Submit Form + Live Policy Checklist */}
        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="rounded-2xl bg-white dark:bg-slate-900 p-5 border border-slate-200 dark:border-slate-800 shadow-card space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600"/> Request Details
            </h3>

            {targetMode === 'SPECIFIC' && (<div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-xs">
                <span className="text-slate-500 dark:text-slate-400 block">Target Selection</span>
                <span className="font-bold text-indigo-900 dark:text-indigo-200">
                  {selectedRoom
                ? `Room ${selectedRoom.roomNumber} (${selectedRoom.type}, ${selectedRoom.bedCount}-Bed)`
                : 'Click a room card on the left'}
                </span>
              </div>)}

            <div>
              <label className="block text-xs font-semibold mb-1">Reason for Exchange</label>
              <textarea required minLength={5} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Need closer proximity to project lab group or medical floor preference..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Request Expiry Date</label>
              <input type="date" required value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"/>
            </div>

            <button type="submit" disabled={submitting || (validation !== null && !validation.passed)} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2">
              {submitting ? (<Loader2 className="w-4 h-4 animate-spin"/>) : (<Send className="w-4 h-4"/>)}
              Submit & Detect Swaps
            </button>
          </form>

          <ValidationChecklist validation={validation}/>
        </div>
      </div>
    </div>);
}
