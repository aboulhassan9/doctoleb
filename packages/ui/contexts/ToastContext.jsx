import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast types: 'success', 'error', 'warning', 'info'
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* aria-live so screen readers announce new toasts without stealing focus */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem = ({ toast, onRemove }) => {
  const pausedRef = useRef(false);
  const startRef = useRef(Date.now());
  const remainingRef = useRef(toast.duration);
  const timerRef = useRef(null);

  const start = useCallback(() => {
    if (toast.duration <= 0) return;
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => onRemove(toast.id), remainingRef.current);
  }, [toast.id, toast.duration, onRemove]);

  const pause = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainingRef.current -= Date.now() - startRef.current;
    }
  }, []);

  useEffect(() => {
    start();
    return () => clearTimeout(timerRef.current);
  }, [start]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-critical" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-primary" />
  };

  const borderColors = {
    success: 'border-l-4 border-green-500',
    error: 'border-l-4 border-critical',
    warning: 'border-l-4 border-yellow-500',
    info: 'border-l-4 border-primary'
  };

  // Errors use role="alert" (assertive) so screen readers interrupt immediately
  const role = toast.type === 'error' ? 'alert' : 'status';

  return (
    <motion.div
      role={role}
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
      layout
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-white border border-gray-100 min-w-[300px] max-w-sm ${borderColors[toast.type]}`}
    >
      <span className="shrink-0">{icons[toast.type]}</span>
      <p className="flex-1 text-gray-800 font-medium text-sm leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
