import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const SidebarProvider = ({ children }) => {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }, [isCollapsed]);

    useEffect(() => {
        const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const toggleSidebar = () => setIsCollapsed(!isCollapsed);
    const closeMobile = () => setMobileOpen(false);

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, mobileOpen, setMobileOpen, closeMobile }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
};
