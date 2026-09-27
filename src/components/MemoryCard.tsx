import React, { useState } from 'react';
import { Play, Calendar, Film, Image as ImageIcon } from 'lucide-react';
import { Memory } from '../types';
import { useResolvedMediaUrl } from '../services/cloudMediaStorage';

interface MemoryCardProps {
  memory: Memory;
  albumName?: string;
  onClick: (memory: Memory) => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ memory, albumName, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Preferred preview image:
  // For photo: thumbnailUrl -> mediaUrl
  // For video: posterUrl -> thumbnailUrl -> fallback video frame
  const rawPreviewUrl =
    memory.type === 'video'
      ? memory.posterUrl || memory.thumbnailUrl
      : memory.thumbnailUrl || memory.mediaUrl;

  const { resolvedUrl: displayImage } = useResolvedMediaUrl(rawPreviewUrl);
  const { resolvedUrl: resolvedVideoUrl } = useResolvedMediaUrl(
    memory.type === 'video' && !displayImage ? memory.mediaUrl : null
  );

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
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  })();

  return (
    <div
      onClick={() => onClick(memory)}
      className="group relative cursor-pointer break-inside-avoid mb-4 sm:mb-6 rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 select-none animate-fade-in"
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
      <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
        {/* Skeleton while loading */}
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 bg-slate-200/60 animate-pulse flex items-center justify-center">
            {memory.type === 'video' ? (
              <Film className="w-8 h-8 text-slate-300" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-300" />
            )}
          </div>
        )}

        {/* Media Content */}
        {memory.type === 'video' && !displayImage ? (
          <div className="w-full h-full relative bg-slate-900">
            {resolvedVideoUrl ? (
              <video
                src={resolvedVideoUrl}
                preload="metadata"
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
        ) : displayImage && !hasError ? (
          <img
            src={displayImage}
            alt={memory.title || 'Baby memory'}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setHasError(true);
              setIsLoaded(true);
            }}
            className={`w-full h-full object-cover group-hover:scale-103 transition-transform duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50 text-sky-400 p-4">
            <ImageIcon className="w-10 h-10 mb-1" />
            <span className="text-xs font-medium text-slate-400">Media Preview</span>
          </div>
        )}

        {/* Video Play badge overlay */}
        {memory.type === 'video' && (
          <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/10 flex items-center justify-center transition-colors">
            <div className="w-12 h-12 rounded-full bg-white/90 text-sky-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 ml-0.5 fill-sky-600" />
            </div>
          </div>
        )}

        {/* Media type indicator badge */}
        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-900/60 backdrop-blur-xs text-white text-[10px] font-medium flex items-center gap-1">
          {memory.type === 'video' ? (
            <>
              <Film className="w-3 h-3 text-sky-300" />
              <span>Video</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-3 h-3 text-sky-300" />
              <span>Photo</span>
            </>
          )}
        </div>

        {/* Optional Album tag */}
        {albumName && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-semibold tracking-wide shadow-xs truncate max-w-[130px]">
            {albumName}
          </div>
        )}
      </div>

      {/* Info card footer */}
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
    </div>
  );
};
