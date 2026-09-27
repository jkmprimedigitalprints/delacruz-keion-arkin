import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-200 animate-fade-in ${
              toast.type === 'success'
                ? 'bg-[#0B1D35]/95 [.light_&]:bg-emerald-50/95 border-emerald-400/35 text-emerald-200 [.light_&]:text-emerald-800'
                : toast.type === 'error'
                ? 'bg-[#0B1D35]/95 [.light_&]:bg-rose-50/95 border-rose-400/35 text-rose-200 [.light_&]:text-rose-800'
                : 'bg-[#0B1D35]/95 [.light_&]:bg-sky-50/95 border-[#6FA8DC]/35 text-[#D9ECFF] [.light_&]:text-sky-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 [.light_&]:text-emerald-600 shrink-0" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 [.light_&]:text-rose-600 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-[#A9D6F5] [.light_&]:text-sky-600 shrink-0" />}
              <span className="leading-snug">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
