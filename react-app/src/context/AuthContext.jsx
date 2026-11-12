import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('hostelswap_token'));
    const [loading, setLoading] = useState(true);
    const refreshProfile = useCallback(async () => {
        const saved = localStorage.getItem('hostelswap_token');
        if (!saved) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const res = await apiClient.get('/auth/me');
            setUser(res.data.data);
        }
        catch {
            localStorage.removeItem('hostelswap_token');
            setToken(null);
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
        const { token: newToken, user: userProfile } = res.data.data;
        localStorage.setItem('hostelswap_token', newToken);
        setToken(newToken);
        setUser(userProfile);
        return userProfile;
    };
    const register = async (payload) => {
        const res = await apiClient.post('/auth/register', payload);
        const { token: newToken, user: userProfile } = res.data.data;
        localStorage.setItem('hostelswap_token', newToken);
        setToken(newToken);
        setUser(userProfile);
        return userProfile;
    };
    const logout = () => {
        localStorage.removeItem('hostelswap_token');
        setToken(null);
        setUser(null);
    };
    return (<AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>);
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx)
        throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}
