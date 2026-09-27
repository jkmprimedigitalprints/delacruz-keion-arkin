import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Check,
  FolderHeart,
  Sparkles,
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

    // Require intentional horizontal swipe (>= 45px) and horizontal dominance over vertical movement
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/45 backdrop-blur-md select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={cleanTitle || 'Memory viewer'}
    >
      {/* Premium Minimalist Baby Album Modal Card */}
      <div
        className="relative w-[96vw] sm:w-[92vw] max-w-5xl max-h-[94vh] bg-[#FDFBF7] text-slate-800 rounded-3xl shadow-[0_24px_70px_-15px_rgba(15,23,42,0.28)] border border-[#F1ECE1] flex flex-col overflow-hidden transition-all duration-150"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Subtle top pastel baby blue & blush accent line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#E0F2FE] via-[#FDF2F8] to-[#E0F2FE]" />

        {/* Header Bar: Subtle Keepsake Badge + Top-Right Circular Controls */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0F9FF] border border-sky-100/80 text-sky-700 text-[11px] font-medium tracking-wide">
              <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
              <span className="truncate">
                {currentAlbum ? currentAlbum.name : 'Keion Arkin Keepsake'}
              </span>
            </span>
            {currentAlbum && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
                <FolderHeart className="w-3 h-3 text-rose-300" />
                <span>Album</span>
              </span>
            )}
          </div>

          {/* Right Controls & Circular Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-sky-50 text-slate-500 hover:text-sky-600 border border-slate-200/70 flex items-center justify-center transition shadow-2xs"
              title={copied ? 'Copied link!' : 'Share memory'}
              aria-label="Share memory"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
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
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 hover:bg-sky-50 text-slate-500 hover:text-sky-600 border border-slate-200/70 flex items-center justify-center transition shadow-2xs"
                title="Download original"
                aria-label="Download original"
              >
                <Download className="w-4 h-4" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white hover:bg-rose-50/70 text-slate-600 hover:text-slate-900 border border-slate-200/80 flex items-center justify-center transition shadow-xs ml-1"
              title="Close (Esc)"
              aria-label="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stable Responsive Media Stage (Prevents Layout Shift between Portrait/Landscape/Square) */}
        <div className="relative w-full h-[56vh] sm:h-[62vh] md:h-[66vh] max-h-[78vh] px-3 sm:px-14 py-2 flex items-center justify-center shrink-0">
          {/* Soft cream inner mat */}
          <div className="relative w-full h-full rounded-2xl bg-[#F7F4EE]/90 border border-[#EFEAE0] flex items-center justify-center overflow-hidden">
            {/* Subtle corner loading pill when high-res image is finishing download */}
            {isHiResLoading && (
              <div className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-sky-100 text-slate-500 text-[11px] font-medium shadow-2xs">
                <Loader2 className="w-3 h-3 animate-spin text-sky-500" />
                <span> Optimizing</span>
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
                <div className="text-xs text-slate-400">Video unavailable</div>
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
                  // Fallback to thumbnail_url if media_url fails
                  if (
                    memory.thumbnailUrl &&
                    displayedSrc !== memory.thumbnailUrl
                  ) {
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
              <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-6">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
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
              className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 hover:bg-sky-50 text-slate-700 hover:text-sky-600 border border-slate-200/80 shadow-md flex items-center justify-center transition active:scale-95"
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
              className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 hover:bg-sky-50 text-slate-700 hover:text-sky-600 border border-slate-200/80 shadow-md flex items-center justify-center transition active:scale-95"
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
                <h2 className="font-serif text-base sm:text-xl font-semibold text-slate-800 leading-snug">
                  {cleanTitle}
                </h2>
              )}

              {formattedDate && (
                <span className="text-xs font-medium text-sky-600/90 tracking-wide">
                  {formattedDate}
                </span>
              )}

              {cleanCaption && (
                <p className="text-xs sm:text-sm text-slate-500 font-light leading-relaxed mt-1 max-w-xl">
                  {cleanCaption}
                </p>
              )}
            </div>
          )}

          {/* Bottom-Center Counter (e.g. 10 / 148) */}
          {totalCount > 0 && currentIndex !== -1 && (
            <div className="mt-0.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F5F1E8] border border-[#EAE3D5] text-[11px] sm:text-xs font-semibold text-slate-600 tracking-wider">
              <span>
                {currentIndex + 1} / {totalCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
