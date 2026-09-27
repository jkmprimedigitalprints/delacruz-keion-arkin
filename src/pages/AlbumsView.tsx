import React, { useState, useEffect } from 'react';
import { listenToAlbums, listenToMemories } from '../supabase/database';
import { Album } from '../types';
import { FolderHeart, ChevronRight, Sparkles, PlusCircle } from 'lucide-react';

interface AlbumsViewProps {
  navigate: (path: string) => void;
  onSelectAlbum: (albumId: string) => void;
}

export const AlbumsView: React.FC<AlbumsViewProps> = ({ navigate, onSelectAlbum }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [memoriesMap, setMemoriesMap] = useState<Map<string, string | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubAlbums = listenToAlbums((newAlbums) => {
      setAlbums(newAlbums);
      setIsLoading(false);
    });

    const unsubMemories = listenToMemories({
      onInitialLoad: (memories) => {
        const nextMap = new Map<string, string | null>();
        memories.forEach((m) => {
          nextMap.set(m.id, m.albumId || null);
        });
        setMemoriesMap(nextMap);
      },
      onAdded: (m) => {
        setMemoriesMap((prev) => {
          const next = new Map(prev);
          next.set(m.id, m.albumId || null);
          return next;
        });
      },
      onModified: (m) => {
        setMemoriesMap((prev) => {
          const next = new Map(prev);
          next.set(m.id, m.albumId || null);
          return next;
        });
      },
      onRemoved: (id) => {
        setMemoriesMap((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      },
    });

    return () => {
      unsubAlbums();
      unsubMemories();
    };
  }, []);

  const memoryCountByAlbum: Record<string, number> = {};
  memoriesMap.forEach((albumId) => {
    if (albumId) {
      memoryCountByAlbum[albumId] = (memoryCountByAlbum[albumId] || 0) + 1;
    }
  });

  const handleAlbumClick = (albumId: string) => {
    onSelectAlbum(albumId);
    navigate('/memories');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 min-h-[70vh]">
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#A9D6F5] [.light_&]:text-[#2563EB] tracking-wide mb-2">
          <FolderHeart className="w-3.5 h-3.5 text-[#6FA8DC]" />
          <span>Curated Chapters</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[var(--text-primary)]">
          Memory Albums
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] font-light">
          Browse special milestones, monthly growth, and family adventures organized into albums.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="night-card rounded-2xl overflow-hidden animate-pulse p-4 space-y-3"
            >
              <div className="aspect-16/10 bg-[#0B1D35] [.light_&]:bg-slate-200 rounded-xl" />
              <div className="h-4 bg-[#153052] [.light_&]:bg-slate-200 rounded-md w-1/2" />
              <div className="h-3 bg-[#153052] [.light_&]:bg-slate-200 rounded-md w-3/4" />
            </div>
          ))}
        </div>
      ) : albums.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => {
            const count = memoryCountByAlbum[album.id] || 0;

            return (
              <div
                key={album.id}
                onClick={() => handleAlbumClick(album.id)}
                className="group relative cursor-pointer night-card night-card-interactive rounded-2xl p-3 flex flex-col"
                role="button"
                tabIndex={0}
              >
                {/* Album Cover */}
                <div className="relative aspect-16/10 rounded-xl overflow-hidden bg-gradient-to-tr from-[#0B1D35] via-[#102642] to-[#17355A] [.light_&]:from-sky-100 [.light_&]:via-sky-50 [.light_&]:to-blue-50">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#6FA8DC]">
                      <FolderHeart className="w-12 h-12 mb-2 group-hover:scale-105 transition-transform" />
                      <span className="text-xs font-medium text-[var(--text-muted)]">Memory Album</span>
                    </div>
                  )}

                  {/* Count label */}
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-[#071426]/75 backdrop-blur-xs border border-[#A9D6F5]/20 text-[#D9ECFF] text-[11px] font-medium tabular-nums">
                    {count} {count === 1 ? 'item' : 'items'}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[#D9ECFF] [.light_&]:group-hover:text-[#2563EB] transition-colors">
                      {album.name}
                    </h3>
                    {album.description && (
                      <p className="text-xs text-[var(--text-secondary)] font-light line-clamp-2 mt-1 leading-relaxed">
                        {album.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[#A9D6F5] [.light_&]:text-[#2563EB]">
                    <span>View Album</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-md mx-auto text-center p-8 night-card rounded-3xl my-8">
          <FolderHeart className="w-12 h-12 text-[#6FA8DC] mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
            No Albums Created Yet
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 mb-5">
            Organize milestones by month, events, or celebrations from Family Admin.
          </p>
          <button
            onClick={() => navigate('/familyadmin/albums')}
            className="px-4 py-2 rounded-xl btn-night-primary text-xs cursor-pointer"
          >
            Create First Album
          </button>
        </div>
      )}
    </div>
  );
};
