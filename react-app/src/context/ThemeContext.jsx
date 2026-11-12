import React, { createContext, useContext, useEffect, useState } from 'react';
const ThemeContext = createContext(undefined);
export function ThemeProvider({ children }) {
    const [dark, setDark] = useState(() => {
        return localStorage.getItem('hostelswap_theme') === 'dark';
    });
    useEffect(() => {
        const root = document.documentElement;
        if (dark) {
            root.classList.add('dark');
            localStorage.setItem('hostelswap_theme', 'dark');
        }
        else {
            root.classList.remove('dark');
            localStorage.setItem('hostelswap_theme', 'light');
        }
    }, [dark]);
    return (<ThemeContext.Provider value={{ dark, toggleDark: () => setDark((d) => !d) }}>
      {children}
    </ThemeContext.Provider>);
}
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx)
        throw new Error('useTheme must be used inside ThemeProvider');
    return ctx;
}
