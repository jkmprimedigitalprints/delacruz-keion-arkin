import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Ban,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Film,
  AlertTriangle,
} from 'lucide-react';
import { uploadManager } from '../services/uploadManager';
import { UploadItem } from '../types';

export const UploadQueueModal: React.FC = () => {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const unsubscribe = uploadManager.subscribe((newItems) => {
      setItems(newItems);
    });
    return unsubscribe;
  }, []);

  if (items.length === 0) return null;

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  let totalBytesTransferred = 0;
  let totalBytesToTransfer = 0;

  items.forEach((item) => {
    const fileSize = item.size || 1;
    totalBytesToTransfer += fileSize;
    if (item.status === 'completed') {
      totalBytesTransferred += fileSize;
    } else if (
      item.status === 'uploading' ||
      item.status === 'finalizing' ||
      item.status === 'syncing' ||
      item.status === 'retrying'
    ) {
      totalBytesTransferred += item.bytesTransferred || Math.round((fileSize * item.progress) / 100);
    }
  });

  const overallPercentage =
    totalBytesToTransfer > 0
      ? Math.min(100, Math.round((totalBytesTransferred / totalBytesToTransfer) * 100))
      : 0;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <aside
      aria-label="Upload Progress"
      className="fixed bottom-4 right-4 z-50 w-full max-w-md night-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in transition-all"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#122D4F] to-[#1D4373] [.light_&]:from-sky-600 [.light_&]:to-blue-600 text-[#F0F7FF] border-b border-[var(--border-subtle)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Upload className="w-5 h-5 text-[#A9D6F5]" />
          <div>
            <h4 className="text-sm font-semibold">
              {completedCount === totalCount
                ? 'All uploads completed ✓'
                : failedCount > 0 && completedCount + failedCount === totalCount
                ? `Sync Failed (${failedCount} of ${totalCount})`
                : `Uploading ${completedCount} of ${totalCount}`}
            </h4>
            <span className="text-[11px] text-[#B8D4EE] [.light_&]:text-sky-100/90 font-medium">
              Overall: {overallPercentage}% complete ({formatFileSize(totalBytesTransferred)} /{' '}
              {formatFileSize(totalBytesToTransfer)})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg hover:bg-white/15 text-[#F0F7FF] transition cursor-pointer"
            title={isMinimized ? 'Expand' : 'Minimize'}
            aria-label={isMinimized ? 'Expand queue' : 'Minimize queue'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {(completedCount === totalCount || completedCount + failedCount === totalCount) && (
            <button
              onClick={() => uploadManager.clearAll()}
              className="p-1 rounded-lg hover:bg-white/15 text-[#F0F7FF] transition cursor-pointer"
              title="Close and dismiss"
              aria-label="Close queue"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Real Progress Bar */}
      <div className="w-full bg-[#071426] [.light_&]:bg-slate-100 h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${
            failedCount > 0 ? 'bg-rose-500' : 'bg-[#6FA8DC]'
          }`}
          style={{ width: `${overallPercentage}%` }}
        />
      </div>

      {/* Item List (Collapsible) */}
      {!isMinimized && (
        <div className="max-h-80 overflow-y-auto p-3 flex flex-col gap-2 divide-y divide-[var(--border-subtle)]">
          {items.map((item) => (
            <div key={item.id} className="pt-2 first:pt-0 flex items-center gap-3">
              {/* Preview Thumbnail */}
              <div className="relative w-12 h-12 rounded-xl bg-[#0B1D35] shrink-0 overflow-hidden border border-[var(--border-subtle)]">
                {item.previewUrl ? (
                  item.type === 'photo' ? (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-center bg-[#0B1D35] text-[#6FA8DC]">
                      <video
                        src={item.previewUrl}
                        preload="metadata"
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-[#071426]/40 flex items-center justify-center pointer-events-none">
                        <Film className="w-4 h-4 text-[#D9ECFF]" />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#0B1D35] text-[#6FA8DC]">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Details & Progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-[var(--text-primary)] truncate" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0 ml-2">
                    {formatFileSize(item.size)}
                  </span>
                </div>

                {/* Status States */}
                {item.status === 'queued' && (
                  <span className="text-[11px] text-[var(--text-muted)] font-medium">Queued</span>
                )}

                {item.status === 'starting' && (
                  <span className="text-[11px] text-[#A9D6F5] [.light_&]:text-sky-600 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Preparing...
                  </span>
                )}

                {item.status === 'uploading' && (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[#0B1D35] [.light_&]:bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#6FA8DC] h-full rounded-full transition-all duration-150"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-[#A9D6F5] [.light_&]:text-sky-600">
                        Uploading... ({item.progress}%)
                      </span>
                    </div>
                    {item.isStalled && (
                      <span className="text-[10px] text-amber-400 [.light_&]:text-amber-600 flex items-center gap-1 mt-0.5 font-medium">
                        <AlertTriangle className="w-3 h-3" /> Large file transfer in progress…
                      </span>
                    )}
                  </div>
                )}

                {(item.status === 'finalizing' || item.status === 'syncing') && (
                  <span className="text-[11px] text-[#A9D6F5] [.light_&]:text-blue-600 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
                  </span>
                )}

                {item.status === 'retrying' && (
                  <span className="text-[11px] text-amber-400 [.light_&]:text-amber-600 flex items-center gap-1 font-semibold">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Retrying (Attempt{' '}
                    {item.retryAttempt || 2}/3)…
                  </span>
                )}

                {item.status === 'completed' && (
                  <span className="text-[11px] text-emerald-400 [.light_&]:text-emerald-600 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                )}

                {item.status === 'cancelled' && (
                  <span className="text-[11px] text-[var(--text-muted)] font-medium flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Cancelled
                  </span>
                )}

                {item.status === 'failed' && (
                  <span
                    className="text-[11px] text-rose-400 [.light_&]:text-rose-600 font-medium flex items-center gap-1 truncate"
                    title={item.error || 'Sync Failed'}
                  >
                    <AlertCircle className="w-3 h-3 shrink-0" /> {item.error || 'Sync Failed'}
                  </span>
                )}
              </div>

              {/* Action buttons (Retry / Cancel) */}
              <div className="shrink-0 flex items-center gap-1">
                {(item.status === 'failed' || item.isStalled) && (
                  <button
                    onClick={() => uploadManager.retry(item.id)}
                    className="px-2.5 py-1 btn-night-secondary text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                    title="Retry syncing this file to Supabase"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                )}

                {(item.status === 'queued' ||
                  item.status === 'starting' ||
                  item.status === 'uploading' ||
                  item.status === 'syncing' ||
                  item.status === 'retrying') && (
                  <button
                    onClick={() => uploadManager.cancel(item.id)}
                    className="p-1 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                    title="Cancel upload"
                    aria-label="Cancel upload"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      {!isMinimized && (
        <div className="px-4 py-2.5 bg-[#0B1D35] [.light_&]:bg-slate-50 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Concurrency: Images (3), Videos (1)</span>
          <button
            onClick={() => uploadManager.clearCompleted()}
            className="text-[#A9D6F5] [.light_&]:text-sky-600 hover:underline font-semibold transition cursor-pointer"
          >
            Clear Finished
          </button>
        </div>
      )}
    </aside>
  );
};
