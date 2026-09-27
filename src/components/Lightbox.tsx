import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Check,
  Calendar,
  FolderHeart,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import { Memory, Album } from '../types';
import { useResolvedMediaUrl } from '../services/cloudMediaStorage';

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { resolvedUrl: fullMediaUrl, isResolving } = useResolvedMediaUrl(memory?.mediaUrl);
  const displayMediaUrl = fullMediaUrl || memory?.thumbnailUrl || '';

  const currentIndex = memory ? memoriesList.findIndex((m) => m.id === memory.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < memoriesList.length - 1 && currentIndex !== -1;

  const currentAlbum = memory?.albumId
    ? albums.find((a) => a.id === memory.albumId)
    : null;

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!memory) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [memory, handlePrev, handleNext, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (memory) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [memory]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    setTouchStart(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleShare = async () => {
    if (!memory) return;
    const shareUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory.title || 'Baby Boy Memory',
          text: memory.caption || 'Look at this precious memory!',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or unsupported
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
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col justify-between backdrop-blur-md animate-fade-in select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Bar Controls */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-medium text-slate-300">
            {currentIndex + 1} of {memoriesList.length}
          </span>
          {currentAlbum && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/10 text-sky-300">
              <FolderHeart className="w-3.5 h-3.5" />
              {currentAlbum.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={handleShare}
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition flex items-center gap-1"
            title={copied ? 'Copied link!' : 'Share memory'}
            aria-label="Share"
          >
            {copied ? (
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            ) : (
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {displayMediaUrl && (
            <a
              href={displayMediaUrl}
              download={memory.fileName || 'memory'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition"
              title="Download original file"
              aria-label="Download"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
          )}

          <button
            onClick={toggleFullscreen}
            className="hidden sm:block p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition"
            title="Toggle fullscreen"
            aria-label="Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition ml-2"
            title="Close viewer (Esc)"
            aria-label="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main Media Area */}
      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden">
        {/* Navigation Previous */}
        {hasPrev && (
          <button
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 z-20 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-white/20 text-white backdrop-blur-xs transition"
            title="Previous memory (Left Arrow)"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Media Item */}
        <div className="max-w-5xl max-h-full w-full h-full flex items-center justify-center">
          {isResolving && !displayMediaUrl ? (
            <div className="flex flex-col items-center gap-2 text-slate-300">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
              <span className="text-xs font-medium">Loading high-resolution media...</span>
            </div>
          ) : memory.type === 'video' ? (
            fullMediaUrl ? (
              <video
                ref={videoRef}
                src={fullMediaUrl}
                poster={memory.posterUrl || memory.thumbnailUrl || undefined}
                controls
                autoPlay
                playsInline
                preload="metadata"
                className="max-h-[75vh] sm:max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-300">
                <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
                <span className="text-xs font-medium">Loading video stream...</span>
              </div>
            )
          ) : (
            <img
              src={displayMediaUrl}
              alt={memory.title || 'Memory photo'}
              className="max-h-[75vh] sm:max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain animate-fade-in"
            />
          )}
        </div>

        {/* Navigation Next */}
        {hasNext && (
          <button
            onClick={handleNext}
            className="absolute right-3 sm:right-6 z-20 p-2.5 sm:p-3 rounded-full bg-black/40 hover:bg-white/20 text-white backdrop-blur-xs transition"
            title="Next memory (Right Arrow)"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}
      </div>

      {/* Bottom Info Drawer */}
      <div className="px-4 sm:px-6 py-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent z-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-1.5 text-center sm:text-left">
          {formattedDate && (
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-sky-300 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
          )}

          {memory.title && (
            <h2 className="text-base sm:text-xl font-semibold text-white">
              {memory.title}
            </h2>
          )}

          {memory.caption && (
            <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
              {memory.caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
