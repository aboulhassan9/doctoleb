import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const saved = localStorage.getItem('clinicTheme');
        return saved === 'dark';
    });

    const [customBg, setCustomBg] = useState(() => {
        return localStorage.getItem('clinicCustomBg') || '';
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('clinicTheme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('clinicTheme', 'light');
        }
    }, [isDarkMode]);

    useEffect(() => {
        if (customBg) {
            document.body.style.backgroundColor = customBg;
            localStorage.setItem('clinicCustomBg', customBg);
        } else {
            document.body.style.backgroundColor = '';
            localStorage.removeItem('clinicCustomBg');
        }
    }, [customBg]);

    return (
        <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, customBg, setCustomBg }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
