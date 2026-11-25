'use client';
import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Sparkles, UserPlus } from 'lucide-react';
import { useAuth, useToast } from '@/context/Providers';
import { getApiErrorMessage } from '@/lib/apiClient';

const DEMO_USERS = [
    { label: 'Student A (Aarav · AC · In 3-Cycle)', email: 'aarav@hostel.edu', pass: 'Student@123' },
    { label: 'Student B (Rohan · Pending Accept)', email: 'rohan@hostel.edu', pass: 'Student@123' },
    { label: 'Student D (Deepak · Non-AC Blocked)', email: 'deepak@hostel.edu', pass: 'Student@123' },
    { label: 'Warden (Approver Queue)', email: 'warden@hostel.edu', pass: 'Warden@123' },
    { label: 'Admin (Policies & Stats)', email: 'admin@hostel.edu', pass: 'Admin@123' },
];

export default function LoginPage() {
    const { login, register } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const [mode, setMode] = useState('login');
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('aarav@hostel.edu');
    const [password, setPassword] = useState('Student@123');
    const [selectedDemo, setSelectedDemo] = useState('aarav@hostel.edu');
    const [showPassword, setShowPassword] = useState(false);
    const submitBtnRef = useRef(null);
    const [name, setName] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [year, setYear] = useState(2);
    const [gender, setGender] = useState('MALE');
    const [branch, setBranch] = useState('CSE');
    const [acEligible, setAcEligible] = useState(true);

    const redirectByRole = (role) => {
        if (role === 'WARDEN')
            router.push('/warden');
        else if (role === 'ADMIN')
            router.push('/admin');
        else
            router.push('/dashboard');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (mode === 'login') {
                const u = await login(email, password);
                showToast('success', 'Welcome back!', `Signed in as ${u.name} (${u.role})`);
                redirectByRole(u.role);
            }
            else {
                const u = await register({
                    name,
                    email,
                    password,
                    rollNumber,
                    year,
                    gender,
                    branch,
                    acEligible,
                });
                showToast('success', 'Account created!', `Assigned room profile for ${u.name}`);
                redirectByRole(u.role);
            }
        }
        catch (err) {
            showToast('error', 'Authentication Failed', getApiErrorMessage(err));
        }
        finally {
            setLoading(false);
        }
    };

    const selectDemoUser = (demoEmail, demoPass) => {
        setMode('login');
        setEmail(demoEmail);
        setPassword(demoPass);
        setSelectedDemo(demoEmail);
        setTimeout(() => {
            submitBtnRef.current?.focus();
        }, 0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-teal-50/30 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-5 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="lg:col-span-2 bg-indigo-600 dark:bg-indigo-950 text-white p-8 flex flex-col justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2.5 bg-white/15 px-3 py-1.5 rounded-full text-xs font-semibold mb-6">
                            <Sparkles className="w-4 h-4" /> Next.js App Router Portal
                        </div>
                        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
                            <ArrowLeftRight className="w-7 h-7" /> HostelSwap
                        </h1>
                        <p className="text-indigo-100 text-sm mt-3 leading-relaxed">
                            Policy-validated room exchange engine with graph cycle detection (A→B→C→A),
                            bed-level tracking, and atomic warden approvals.
                        </p>
                    </div>

                    <div className="mt-8 space-y-2">
                        <p className="text-[11px] uppercase tracking-wider font-bold text-indigo-200 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" /> 1-Click Demo Logins
                        </p>
                        <div className="space-y-1.5">
                            {DEMO_USERS.map((d) => {
                                const isSelected = selectedDemo === d.email && mode === 'login';
                                return (
                                    <button
                                        key={d.email}
                                        type="button"
                                        disabled={loading}
                                        onClick={() => selectDemoUser(d.email, d.pass)}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                                            isSelected
                                                ? 'bg-white/25 ring-2 ring-white/60 shadow-sm'
                                                : 'bg-white/10 hover:bg-white/20'
                                        }`}
                                    >
                                        <span className="truncate">{d.label}</span>
                                        <span className="text-[10px] opacity-75 shrink-0 ml-2">Login →</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 p-8 sm:p-10">
                    <div className="flex gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 mb-6">
                        <button
                            type="button"
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'login'
                                    ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            Sign In
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('register')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'register'
                                    ? 'bg-white dark:bg-slate-900 shadow-sm text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            Student Register
                        </button>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                        {mode === 'login' ? 'Sign in to your portal' : 'Create Student Account'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                        {mode === 'login'
                            ? 'Access room details, swap chains, and approvals.'
                            : 'Automatically allocates an available gender-matched bed.'}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'register' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Full Name</label>
                                    <input
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Priya Nair"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Roll Number</label>
                                    <input
                                        required
                                        value={rollNumber}
                                        onChange={(e) => setRollNumber(e.target.value)}
                                        placeholder="CS2025999"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1">Branch</label>
                                    <input
                                        required
                                        value={branch}
                                        onChange={(e) => setBranch(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Year</label>
                                        <select
                                            value={year}
                                            onChange={(e) => setYear(Number(e.target.value))}
                                            className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                        >
                                            {[1, 2, 3, 4].map((y) => (
                                                <option key={y} value={y}>
                                                    Year {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold mb-1">Gender</label>
                                        <select
                                            value={gender}
                                            onChange={(e) => setGender(e.target.value)}
                                            className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                        >
                                            <option value="MALE">Male</option>
                                            <option value="FEMALE">Female</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold mb-1">Campus Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                    className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {mode === 'register' && (
                            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={acEligible}
                                    onChange={(e) => setAcEligible(e.target.checked)}
                                    className="rounded text-indigo-600"
                                />
                                <span>AC Hostel Fee Paid (AC Eligible)</span>
                            </label>
                        )}

                        <button
                            ref={submitBtnRef}
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : mode === 'login' ? (
                                <ShieldCheck className="w-4 h-4" />
                            ) : (
                                <UserPlus className="w-4 h-4" />
                            )}
                            {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}