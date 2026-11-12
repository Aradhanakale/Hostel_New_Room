import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, BedDouble, Bell, ClipboardCheck, FileSpreadsheet, GitCommitHorizontal, LayoutDashboard, LogOut, Menu, Moon, PlusCircle, Shield, Sun, X, } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
export function Layout({ children }) {
    const { user, logout } = useAuth();
    const { dark, toggleDark } = useTheme();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    useEffect(() => {
        let mounted = true;
        const fetchUnread = async () => {
            try {
                const res = await apiClient.get('/notifications');
                if (mounted)
                    setUnreadCount(res.data.data.unreadCount || 0);
            }
            catch {
                // ignore silently
            }
        };
        fetchUnread();
        const timer = setInterval(fetchUnread, 15000);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, []);
    const navItems = [
        ...(user?.role === 'STUDENT'
            ? [
                { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { to: '/my-room', label: 'My Room', icon: BedDouble },
                { to: '/exchange/new', label: 'Request Exchange', icon: PlusCircle },
                { to: '/my-requests', label: 'My Requests', icon: GitCommitHorizontal },
                { to: '/swap-matches', label: 'Swap Matches', icon: ArrowLeftRight },
            ]
            : []),
        ...(user?.role === 'WARDEN' || user?.role === 'ADMIN'
            ? [
                { to: '/warden', label: 'Warden Queue', icon: ClipboardCheck },
                { to: '/admin', label: 'Admin Console', icon: Shield },
                { to: '/audit', label: 'Audit Trail', icon: FileSpreadsheet },
            ]
            : []),
        { to: '/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    ];
    const handleLogout = () => {
        logout();
        navigate('/login');
    };
    return (<div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (<div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)}/>)}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <ArrowLeftRight className="w-5 h-5"/>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block">HostelSwap</span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                React Portal
              </span>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (<NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0"/>
                  {item.label}
                </span>
                {item.badge ? (<span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500 text-white">
                    {item.badge}
                  </span>) : null}
              </NavLink>);
        })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <p className="text-xs font-bold truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
            <span className="inline-block mt-1.5 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {user?.role}
            </span>
          </div>

          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
            <LogOut className="w-4 h-4"/> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Open menu">
            <Menu className="w-5 h-5"/>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
            <span>Connected to HostelSwap Express API</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button onClick={toggleDark} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle color theme">
              {dark ? <Sun className="w-4 h-4 text-amber-400"/> : <Moon className="w-4 h-4"/>}
            </button>

            <Link to="/notifications" className="relative p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Notifications">
              <Bell className="w-4 h-4"/>
              {unreadCount > 0 && (<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>)}
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>);
}
