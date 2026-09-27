import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Check,
  FolderHeart,
  Loader2,
} from 'lucide-react';
import { Memory, Album } from '../types';
import {
  isImageCached,
  markImageCached,
  preloadImage,
  preloadViewerWindow,
} from '../services/cloudMediaStorage';

interface LightboxProps {
  memory: Memory | null;
  memoriesList: Memory[];
  albums: Album[];
  onClose: () => void;
  onNavigate: (memory: Memory) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  memory,
  memoriesList,
  albums,
  onClose,
  onNavigate,
}) => {
  const [copied, setCopied] = useState(false);
  const [displayedSrc, setDisplayedSrc] = useState<string>('');
  const [isHiResLoading, setIsHiResLoading] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentIndex = useMemo(() => {
    if (!memory) return -1;
    return memoriesList.findIndex((m) => m.id === memory.id);
  }, [memory, memoriesList]);

  const totalCount = memoriesList.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < totalCount - 1;

  const currentAlbum = useMemo(() => {
    if (!memory?.albumId) return null;
    return albums.find((a) => a.id === memory.albumId) || null;
  }, [memory?.albumId, albums]);

  // 1. Immediately preload adjacent items (current, previous, next, next + 1)
  useEffect(() => {
    if (!memory || currentIndex === -1) return;
    preloadViewerWindow(memoriesList, currentIndex);
  }, [memory, currentIndex, memoriesList]);

  // 2. Manage instant image source switching & progressive thumbnail -> high-res upgrade
  useEffect(() => {
    if (!memory) {
      setDisplayedSrc('');
      setIsHiResLoading(false);
      setImageLoadError(false);
      return;
    }

    setImageLoadError(false);

    if (memory.type === 'video') {
      setDisplayedSrc(memory.mediaUrl || '');
      setIsHiResLoading(false);
      return;
    }

    const fullUrl = memory.mediaUrl || memory.thumbnailUrl || '';
    const thumbUrl = memory.thumbnailUrl || fullUrl;

    if (!fullUrl) {
      setDisplayedSrc('');
      setIsHiResLoading(false);
      return;
    }

    // If full resolution image is already in session cache, display immediately with zero delay
    if (isImageCached(fullUrl)) {
      setDisplayedSrc(fullUrl);
      setIsHiResLoading(false);
      return;
    }

    // Show already-cached thumbnail immediately if available while high-res preloads
    if (thumbUrl && thumbUrl !== fullUrl && isImageCached(thumbUrl)) {
      setDisplayedSrc(thumbUrl);
      setIsHiResLoading(true);
    } else {
      setDisplayedSrc(fullUrl);
      setIsHiResLoading(true);
    }

    let active = true;
    preloadImage(fullUrl, 'high').then((loaded) => {
      if (!active) return;
      if (loaded) {
        setDisplayedSrc(fullUrl);
        setIsHiResLoading(false);
      } else if (thumbUrl && thumbUrl !== fullUrl) {
        setDisplayedSrc(thumbUrl);
        setIsHiResLoading(false);
      } else {
        setIsHiResLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [memory]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(memoriesList[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, memoriesList, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(memoriesList[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, memoriesList, onNavigate]);

  // Keyboard navigation (ArrowRight -> Next, ArrowLeft -> Previous, Escape -> Close)
  useEffect(() => {
    if (!memory) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memory, handlePrev, handleNext, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!memory) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [memory]);

  // Mobile swipe gesture handling (ignores tiny movements & vertical scroll)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.targetTouches.length !== 1) return;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    if (e.changedTouches.length === 0) return;

    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;

    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      return;
    }

    if (deltaX > 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  const handleShare = async () => {
    if (!memory) return;
    const shareUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory.title || 'Keion Arkin Memory',
          text: memory.caption || 'A precious moment from Keion Arkin’s memory album.',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  if (!memory) return null;

  const formattedDate = (() => {
    try {
      if (!memory.memoryDate) return '';
      let d: Date;
      if (typeof (memory.memoryDate as any).toDate === 'function') {
        d = (memory.memoryDate as any).toDate();
      } else if (memory.memoryDate instanceof Date) {
        d = memory.memoryDate;
      } else {
        d = new Date(memory.memoryDate as any);
      }
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  const cleanTitle = (memory.title || '').trim();
  const cleanCaption = (memory.caption || '').trim();
  const hasMetadata = Boolean(cleanTitle || cleanCaption || formattedDate);
  const downloadHref = memory.mediaUrl || memory.thumbnailUrl || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#071426]/82 [.light_&]:bg-slate-900/45 backdrop-blur-md select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={cleanTitle || 'Memory viewer'}
    >
      {/* Premium Minimalist Baby Night Album Modal Card */}
      <div
        className="relative w-[96vw] sm:w-[92vw] max-w-5xl max-h-[94vh] bg-[#0B1D35] [.light_&]:bg-[#FDFBF7] text-[var(--text-primary)] rounded-3xl shadow-[0_24px_70px_-15px_rgba(4,12,24,0.75)] border border-[var(--border-subtle)] flex flex-col overflow-hidden transition-all duration-150"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Subtle top baby blue & pastel pink accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-[#6FA8DC]/60 via-[#F3C9D9]/70 to-[#6FA8DC]/60" />

        {/* Header Bar: Subtle Keepsake Label + Top-Right Circular Controls */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0 text-xs font-medium text-[#A9D6F5] [.light_&]:text-[#2563EB]">
            <span aria-hidden="true" className="text-sm leading-none">
              ☾
            </span>
            <span className="truncate">
              {currentAlbum ? currentAlbum.name : 'Keion Arkin Keepsake'}
            </span>
            {currentAlbum && (
              <>
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  ·
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <FolderHeart className="w-3 h-3 text-[#F3C9D9]" />
                  <span>Album</span>
                </span>
              </>
            )}
          </div>

          {/* Right Controls & Circular Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full btn-night-secondary flex items-center justify-center cursor-pointer"
              title={copied ? 'Copied link!' : 'Share memory'}
              aria-label="Share memory"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {downloadHref && (
              <a
                href={downloadHref}
                download={memory.fileName || 'memory'}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full btn-night-secondary flex items-center justify-center"
                title="Download original"
                aria-label="Download original"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full btn-night-secondary hover:border-[#F3C9D9]/50 flex items-center justify-center ml-1 cursor-pointer"
              title="Close (Esc)"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stable Responsive Media Stage (Prevents Layout Shift between Portrait/Landscape/Square) */}
        <div className="relative w-full h-[56vh] sm:h-[62vh] md:h-[66vh] max-h-[78vh] px-3 sm:px-14 py-2 flex items-center justify-center shrink-0">
          {/* Midnight Navy inner mat (Soft cream in Light mode) */}
          <div className="relative w-full h-full rounded-2xl bg-[#071426]/90 [.light_&]:bg-[#F7F4EE]/90 border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
            {/* Subtle corner loading indicator when high-res image is finishing download */}
            {isHiResLoading && (
              <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#102642]/90 [.light_&]:bg-white/90 backdrop-blur-xs border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-medium">
                <Loader2 className="w-3 h-3 animate-spin text-[#6FA8DC]" />
                <span>Optimizing</span>
              </div>
            )}

            {memory.type === 'video' ? (
              memory.mediaUrl ? (
                <video
                  key={memory.id}
                  ref={videoRef}
                  src={memory.mediaUrl}
                  poster={memory.posterUrl || memory.thumbnailUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full max-w-full max-h-full object-contain rounded-xl transition-opacity duration-150"
                />
              ) : (
                <div className="text-xs text-[var(--text-muted)]">Video unavailable</div>
              )
            ) : displayedSrc && !imageLoadError ? (
              <img
                key={memory.id}
                src={displayedSrc}
                alt={cleanTitle || 'Keion Arkin memory photo'}
                decoding="async"
                fetchPriority="high"
                onLoad={() => {
                  markImageCached(displayedSrc);
                  if (displayedSrc === memory.mediaUrl) {
                    setIsHiResLoading(false);
                  }
                }}
                onError={() => {
                  if (memory.thumbnailUrl && displayedSrc !== memory.thumbnailUrl) {
                    setDisplayedSrc(memory.thumbnailUrl);
                    setIsHiResLoading(false);
                    return;
                  }
                  setImageLoadError(true);
                  setIsHiResLoading(false);
                }}
                className="w-full h-full max-w-full max-h-full object-contain select-none transition-opacity duration-150 ease-out"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] p-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#6FA8DC]" />
                <span className="text-xs">Loading photo...</span>
              </div>
            )}
          </div>

          {/* Left Center Previous Button */}
          {hasPrev && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full btn-night-secondary shadow-lg flex items-center justify-center active:scale-95 cursor-pointer"
              title="Previous (Left Arrow)"
              aria-label="Previous memory"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}

          {/* Right Center Next Button */}
          {hasNext && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full btn-night-secondary shadow-lg flex items-center justify-center active:scale-95 cursor-pointer"
              title="Next (Right Arrow)"
              aria-label="Next memory"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>

        {/* Footer: Photo Information (Title, Caption, Date) & Bottom-Center Counter */}
        <div className="px-5 sm:px-8 pt-2 pb-4 sm:pb-5 flex flex-col items-center text-center gap-2 shrink-0 overflow-y-auto">
          {hasMetadata && (
            <div className="max-w-2xl mx-auto flex flex-col items-center gap-0.5">
              {cleanTitle && (
                <h2 className="font-serif text-base sm:text-xl font-semibold text-[var(--text-primary)] leading-snug">
                  {cleanTitle}
                </h2>
              )}

              {formattedDate && (
                <span className="text-xs font-medium text-[#A9D6F5] [.light_&]:text-[#2563EB] tracking-wide">
                  {formattedDate}
                </span>
              )}

              {cleanCaption && (
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-light leading-relaxed mt-1 max-w-xl">
                  {cleanCaption}
                </p>
              )}
            </div>
          )}

          {/* Bottom-Center Counter (e.g. 10 / 148) */}
          {totalCount > 0 && currentIndex !== -1 && (
            <div className="mt-0.5 text-[11px] sm:text-xs font-semibold text-[var(--text-muted)] tracking-wider tabular-nums">
              {currentIndex + 1} / {totalCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
