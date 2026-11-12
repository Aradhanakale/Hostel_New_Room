'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
const AuthContext = createContext(undefined);
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used inside Providers');
    return ctx;
}
const ThemeContext = createContext(undefined);
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx)
        throw new Error('useTheme must be used inside Providers');
    return ctx;
}
const ToastContext = createContext(undefined);
export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx)
        throw new Error('useToast must be used inside Providers');
    return ctx;
}
export function Providers({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dark, setDark] = useState(false);
    const [toasts, setToasts] = useState([]);
    useEffect(() => {
        const savedTheme = localStorage.getItem('hostelswap_next_theme');
        if (savedTheme === 'dark') {
            setDark(true);
            document.documentElement.classList.add('dark');
        }
    }, []);
    const toggleDark = () => {
        setDark((prev) => {
            const next = !prev;
            if (next) {
                document.documentElement.classList.add('dark');
                localStorage.setItem('hostelswap_next_theme', 'dark');
            }
            else {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('hostelswap_next_theme', 'light');
            }
            return next;
        });
    };
    const refreshProfile = useCallback(async () => {
        const token = localStorage.getItem('hostelswap_next_token');
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const res = await apiClient.get('/auth/me');
            setUser(res.data.data);
        }
        catch {
            localStorage.removeItem('hostelswap_next_token');
            setUser(null);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);
    const login = async (email, password) => {
        const res = await apiClient.post('/auth/login', { email, password });
        const { token, user: profile } = res.data.data;
        localStorage.setItem('hostelswap_next_token', token);
        setUser(profile);
        return profile;
    };
    const register = async (payload) => {
        const res = await apiClient.post('/auth/register', payload);
        const { token, user: profile } = res.data.data;
        localStorage.setItem('hostelswap_next_token', token);
        setUser(profile);
        return profile;
    };
    const logout = () => {
        localStorage.removeItem('hostelswap_next_token');
        setUser(null);
    };
    const showToast = useCallback((type, title, message) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, type, title, message }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4500);
    }, []);
    return (<ThemeContext.Provider value={{ dark, toggleDark }}>
      <ToastContext.Provider value={{ showToast }}>
        <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile }}>
          {children}
          <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
            <AnimatePresence>
              {toasts.map((t) => (<motion.div key={t.id} initial={{ opacity: 0, y: 18, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }} className={`pointer-events-auto flex items-start gap-3 rounded-2xl p-4 shadow-xl border backdrop-blur-md ${t.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                : t.type === 'error'
                    ? 'bg-rose-50/95 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                    : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'}`}>
                  {t.type === 'success' && (<CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"/>)}
                  {t.type === 'error' && (<AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"/>)}
                  {t.type === 'info' && (<Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5"/>)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{t.title}</p>
                    {t.message && (<p className="text-xs opacity-85 mt-0.5 break-words">{t.message}</p>)}
                  </div>
                  <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                    <X className="w-4 h-4"/>
                  </button>
                </motion.div>))}
            </AnimatePresence>
          </div>
        </AuthContext.Provider>
      </ToastContext.Provider>
    </ThemeContext.Provider>);
}
