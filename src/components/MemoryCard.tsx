import React, { useState, useEffect, memo } from 'react';
import { Play, Calendar, Film, Image as ImageIcon } from 'lucide-react';
import { Memory } from '../types';
import {
  isImageCached,
  markImageCached,
  preloadImage,
} from '../services/cloudMediaStorage';

interface MemoryCardProps {
  memory: Memory;
  albumName?: string;
  onClick: (memory: Memory) => void;
}

const MemoryCardComponent: React.FC<MemoryCardProps> = ({ memory, albumName, onClick }) => {
  // Prefer thumbnail_url for gallery cards, falling back to media_url for older records
  const preferredThumbUrl =
    memory.type === 'video'
      ? memory.posterUrl || memory.thumbnailUrl || null
      : memory.thumbnailUrl || memory.mediaUrl || null;

  const fallbackMediaUrl = memory.type === 'photo' ? memory.mediaUrl || null : null;

  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(preferredThumbUrl);
  const [isLoaded, setIsLoaded] = useState<boolean>(() => isImageCached(preferredThumbUrl));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setActiveImageUrl(preferredThumbUrl);
    setHasError(false);
    setIsLoaded(isImageCached(preferredThumbUrl));
  }, [preferredThumbUrl]);

  // Warm-preload the viewer image as soon as the user hovers or touches the card
  const handleWarmPreload = () => {
    if (memory.type === 'photo') {
      if (memory.mediaUrl) {
        preloadImage(memory.mediaUrl, 'high');
      }
    } else if (memory.posterUrl || memory.thumbnailUrl) {
      preloadImage(memory.posterUrl || memory.thumbnailUrl, 'high');
    }
  };

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
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  const hasFooterContent = Boolean(formattedDate || memory.title || memory.caption);

  return (
    <div
      onClick={() => onClick(memory)}
      onMouseEnter={handleWarmPreload}
      onTouchStart={handleWarmPreload}
      onFocus={handleWarmPreload}
      className="group relative cursor-pointer break-inside-avoid mb-4 sm:mb-6 rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 select-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(memory);
        }
      }}
      aria-label={`View ${memory.title || 'memory'}`}
    >
      {/* Media container */}
      <div className="relative aspect-4/3 w-full bg-[#FAF7F2] overflow-hidden">
        {/* Skeleton while loading */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-slate-100/80 animate-pulse flex items-center justify-center">
            {memory.type === 'video' ? (
              <Film className="w-7 h-7 text-slate-300" />
            ) : (
              <ImageIcon className="w-7 h-7 text-slate-300" />
            )}
          </div>
        )}

        {/* Media Content */}
        {memory.type === 'video' && !activeImageUrl ? (
          <div className="w-full h-full relative bg-slate-900">
            {memory.mediaUrl ? (
              <video
                src={memory.mediaUrl}
                preload="metadata"
                muted
                playsInline
                onLoadedData={() => setIsLoaded(true)}
                onError={() => {
                  setHasError(true);
                  setIsLoaded(true);
                }}
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-10 h-10 text-sky-400" />
              </div>
            )}
          </div>
        ) : activeImageUrl && !hasError ? (
          <img
            src={activeImageUrl}
            alt={memory.title || 'Baby memory'}
            loading="lazy"
            decoding="async"
            onLoad={() => {
              markImageCached(activeImageUrl);
              setIsLoaded(true);
            }}
            onError={() => {
              // Gracefully fall back to media_url if thumbnail_url is missing or broken on older records
              if (
                fallbackMediaUrl &&
                activeImageUrl !== fallbackMediaUrl
              ) {
                setActiveImageUrl(fallbackMediaUrl);
                return;
              }
              setHasError(true);
              setIsLoaded(true);
            }}
            className={`w-full h-full object-cover group-hover:scale-103 transition-opacity duration-200 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50/60 text-sky-400 p-4">
            <ImageIcon className="w-10 h-10 mb-1" />
            <span className="text-xs font-medium text-slate-400">Media Preview</span>
          </div>
        )}

        {/* Video Play badge overlay */}
        {memory.type === 'video' && (
          <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/10 flex items-center justify-center transition-colors">
            <div className="w-11 h-11 rounded-full bg-white/95 text-sky-600 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 ml-0.5 fill-sky-600" />
            </div>
          </div>
        )}

        {/* Media type indicator badge */}
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-900/55 backdrop-blur-xs text-white text-[10px] font-medium flex items-center gap-1">
          {memory.type === 'video' ? (
            <>
              <Film className="w-3 h-3 text-sky-200" />
              <span>Video</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-3 h-3 text-sky-200" />
              <span>Photo</span>
            </>
          )}
        </div>

        {/* Optional Album tag */}
        {albumName && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-semibold tracking-wide shadow-xs truncate max-w-[140px]">
            {albumName}
          </div>
        )}
      </div>

      {/* Info card footer */}
      {hasFooterContent && (
        <div className="p-3.5 sm:p-4">
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-600 mb-1">
              <Calendar className="w-3 h-3" />
              <span>{formattedDate}</span>
            </div>
          )}

          {memory.title && (
            <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-sky-700 transition-colors">
              {memory.title}
            </h3>
          )}

          {memory.caption && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-1 font-light leading-relaxed">
              {memory.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export const MemoryCard = memo(
  MemoryCardComponent,
  (prev, next) =>
    prev.memory.id === next.memory.id &&
    prev.memory.updatedAt === next.memory.updatedAt &&
    prev.memory.title === next.memory.title &&
    prev.memory.caption === next.memory.caption &&
    prev.memory.mediaUrl === next.memory.mediaUrl &&
    prev.memory.thumbnailUrl === next.memory.thumbnailUrl &&
    prev.memory.posterUrl === next.memory.posterUrl &&
    prev.albumName === next.albumName &&
    prev.onClick === next.onClick
);
