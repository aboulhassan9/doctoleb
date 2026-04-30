import React from 'react';
import { useSidebar } from '../contexts/SidebarContext';

export default function MobileTopBar({ title = 'DoctoLeb' }) {
    const { setMobileOpen } = useSidebar();
    return (
        <div className="flex md:hidden items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30 shrink-0">
            <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-1.5 rounded-lg">
                    <span className="material-symbols-outlined text-primary text-xl">medical_services</span>
                </div>
                <span className="font-bold text-slate-900 text-sm">{title}</span>
            </div>
            <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
                <span className="material-symbols-outlined">menu</span>
            </button>
        </div>
    );
}
