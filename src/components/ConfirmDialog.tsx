import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071426]/78 [.light_&]:bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="night-card rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              isDestructive
                ? 'bg-rose-500/15 border-rose-400/30 text-rose-400 [.light_&]:bg-rose-50 [.light_&]:text-rose-600'
                : 'bg-[#0B1D35] [.light_&]:bg-sky-50 border-[var(--border-subtle)] text-[#A9D6F5] [.light_&]:text-sky-600'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
          </div>
        </div>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{message}</p>

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium btn-night-secondary disabled:opacity-50 rounded-xl transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-xs transition disabled:opacity-60 cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'btn-night-primary'
            }`}
          >
            {isLoading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
