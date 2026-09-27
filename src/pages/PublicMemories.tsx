import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  listenToMemories,
  listenToAlbums,
  listenToBabySettings,
  listenToMemoryStatistics,
  MemoryStatistics,
} from '../supabase/database';
import { Memory, Album, BabySettings } from '../types';
import { Hero } from '../components/Hero';
import { MemoryCard } from '../components/MemoryCard';
import { Lightbox } from '../components/Lightbox';
import { TeddyBearToy } from '../components/BabyToysBackground';
import { preloadViewerWindow } from '../services/cloudMediaStorage';
import {
  Image as ImageIcon,
  Film,
  Sparkles,
  ArrowUpDown,
  Filter,
  PlusCircle,
  FolderHeart,
} from 'lucide-react';

interface PublicMemoriesProps {
  navigate: (path: string) => void;
  selectedAlbumId?: string | null;
  onClearAlbumFilter?: () => void;
}

export const PublicMemories: React.FC<PublicMemoriesProps> = ({
  navigate,
  selectedAlbumId = null,
  onClearAlbumFilter,
}) => {
  // In-memory Map: memoryId -> memory object for high-performance granular realtime updates
  const [memoriesMap, setMemoriesMap] = useState<Map<string, Memory>>(new Map());
  const [albums, setAlbums] = useState<Album[]>([]);
  const [stats, setStats] = useState<MemoryStatistics | null>(null);
  const [settings, setSettings] = useState<BabySettings>({
    babyName: 'KEION ARKIN DE LA CRUZ',
    birthDate: '2025-10-12',
    heroQuote: 'Little moments, Big memories',
    heroSubtitle: 'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.',
    coverPhotoUrl: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(selectedAlbumId);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [activeLightboxMemory, setActiveLightboxMemory] = useState<Memory | null>(null);

  // Sync external selectedAlbumId prop
  useEffect(() => {
    setActiveAlbumId(selectedAlbumId);
  }, [selectedAlbumId]);

  // Realtime subscription to Baby Settings
  useEffect(() => {
    const unsub = listenToBabySettings((newSettings) => {
      setSettings(newSettings);
    });
    return unsub;
  }, []);

  // Realtime subscription to Albums
  useEffect(() => {
    const unsub = listenToAlbums((newAlbums) => {
      setAlbums(newAlbums);
    });
    return unsub;
  }, []);

  // Realtime subscription to authoritative database statistics
  useEffect(() => {
    const unsubStats = listenToMemoryStatistics(
      (liveStats) => {
        setStats(liveStats);
      },
      undefined,
      false
    );
    return unsubStats;
  }, []);

  // Realtime subscription to Memories from public.memories
  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = listenToMemories(
      {
        onInitialLoad: (initialMemories) => {
          const nextMap = new Map<string, Memory>();
          initialMemories.forEach((m) => nextMap.set(m.id, m));
          setMemoriesMap(nextMap);
          setIsLoading(false);
        },
        onAdded: (memory) => {
          setMemoriesMap((prev) => {
            const nextMap = new Map(prev);
            nextMap.set(memory.id, memory);
            return nextMap;
          });
        },
        onModified: (memory) => {
          setMemoriesMap((prev) => {
            const nextMap = new Map(prev);
            nextMap.set(memory.id, memory);
            return nextMap;
          });
        },
        onRemoved: (memoryId) => {
          setMemoriesMap((prev) => {
            const nextMap = new Map(prev);
            nextMap.delete(memoryId);
            return nextMap;
          });
        },
        onError: () => {
          setIsLoading(false);
        },
      },
      {
        isAdmin: false,
      }
    );

    return unsubscribe;
  }, []);

  // Convert in-memory map to all memories array
  const allMemories = useMemo(() => {
    return Array.from(memoriesMap.values());
  }, [memoriesMap]);

  // Overall counts for filter tabs & Hero stats (authoritative from public.memories)
  const totalMemories = stats ? stats.totalMemories : allMemories.length;
  const totalPhotos = useMemo(
    () => (stats ? stats.totalPhotos : allMemories.filter((m) => m.type === 'photo').length),
    [stats, allMemories]
  );
  const totalVideos = useMemo(
    () => (stats ? stats.totalVideos : allMemories.filter((m) => m.type === 'video').length),
    [stats, allMemories]
  );

  // Filtered & sorted memories for the gallery view
  const filteredMemories = useMemo(() => {
    let list = [...allMemories];

    // Filter by media type (photo vs video)
    if (activeTypeFilter === 'photo') {
      list = list.filter((m) => m.type === 'photo');
    } else if (activeTypeFilter === 'video') {
      list = list.filter((m) => m.type === 'video');
    }

    // Filter by album
    if (activeAlbumId) {
      list = list.filter((m) => m.albumId === activeAlbumId);
    }

    // Sort
    return list.sort((a, b) => {
      const timeA = a.memoryDate
        ? (typeof (a.memoryDate as any).toMillis === 'function'
            ? (a.memoryDate as any).toMillis()
            : new Date(a.memoryDate as any).getTime())
        : 0;

      const timeB = b.memoryDate
        ? (typeof (b.memoryDate as any).toMillis === 'function'
            ? (b.memoryDate as any).toMillis()
            : new Date(b.memoryDate as any).getTime())
        : 0;

      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [allMemories, activeTypeFilter, activeAlbumId, sortOrder]);

  const albumMap = useMemo(() => {
    const map = new Map<string, string>();
    albums.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [albums]);

  const handleCardClick = useCallback((memory: Memory) => {
    setActiveLightboxMemory(memory);
  }, []);

  const handleLightboxNavigate = useCallback((memory: Memory) => {
    setActiveLightboxMemory(memory);
  }, []);

  // Warm-preload the first photo and its immediate neighbor when the gallery settles
  useEffect(() => {
    if (filteredMemories.length > 0 && !activeLightboxMemory) {
      preloadViewerWindow(filteredMemories, 0);
    }
  }, [filteredMemories, activeLightboxMemory]);

  return (
    <div className="min-h-screen pb-20">
      {/* Baby Hero Section */}
      <Hero
        settings={settings}
        totalMemories={totalMemories}
        totalPhotos={totalPhotos}
        totalVideos={totalVideos}
      />

      {/* Gallery Controls & Filters */}
      <div id="memories-gallery" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6 scroll-mt-16">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Categories: All / Photos / Videos */}
          <div className="flex items-center gap-1.5 p-1 bg-[#0B1D35] [.light_&]:bg-white border border-[var(--border-subtle)] rounded-2xl self-start">
            <button
              onClick={() => setActiveTypeFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTypeFilter === 'all'
                  ? 'btn-night-primary'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#102642]/60 [.light_&]:hover:bg-slate-100'
              }`}
            >
              All Moments
            </button>
            <button
              onClick={() => setActiveTypeFilter('photo')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTypeFilter === 'photo'
                  ? 'btn-night-primary'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#102642]/60 [.light_&]:hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photos ({totalPhotos})</span>
            </button>
            <button
              onClick={() => setActiveTypeFilter('video')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTypeFilter === 'video'
                  ? 'btn-night-primary'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#102642]/60 [.light_&]:hover:bg-slate-100'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Videos ({totalVideos})</span>
            </button>
          </div>

          {/* Right Filters: Album Dropdown & Sort Order */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Album selector */}
            {albums.length > 0 && (
              <div className="relative">
                <select
                  value={activeAlbumId || ''}
                  onChange={(e) => setActiveAlbumId(e.target.value || null)}
                  className="appearance-none pl-8 pr-8 py-2 rounded-xl text-xs font-medium btn-night-secondary focus:outline-hidden focus:ring-2 focus:ring-[#6FA8DC]/40 cursor-pointer"
                  aria-label="Filter by album"
                >
                  <option value="" className="bg-[#0B1D35] text-[#F0F7FF] [.light_&]:bg-white [.light_&]:text-slate-800">
                    All Albums
                  </option>
                  {albums.map((album) => (
                    <option
                      key={album.id}
                      value={album.id}
                      className="bg-[#0B1D35] text-[#F0F7FF] [.light_&]:bg-white [.light_&]:text-slate-800"
                    >
                      {album.name}
                    </option>
                  ))}
                </select>
                <FolderHeart className="w-3.5 h-3.5 text-[#6FA8DC] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="px-3.5 py-2 rounded-xl text-xs font-medium btn-night-secondary flex items-center gap-1.5 cursor-pointer"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#6FA8DC]" />
              <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>

        {/* Active album banner */}
        {activeAlbumId && (
          <div className="mt-4 p-3 bg-[#102642]/80 [.light_&]:bg-sky-50/90 border border-[var(--border-subtle)] rounded-xl flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>
              Showing memories from album:{' '}
              <strong className="text-[var(--text-primary)]">
                {albumMap.get(activeAlbumId) || 'Album'}
              </strong>
            </span>
            <button
              onClick={() => {
                setActiveAlbumId(null);
                onClearAlbumFilter?.();
              }}
              className="font-semibold text-[#A9D6F5] [.light_&]:text-[#2563EB] hover:underline ml-2 cursor-pointer"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Main Gallery Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Loading skeleton */}
        {isLoading && allMemories.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="night-card rounded-2xl overflow-hidden animate-pulse"
              >
                <div className="aspect-4/3 bg-[#0B1D35] [.light_&]:bg-slate-200" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-[#153052] [.light_&]:bg-slate-200 rounded-md w-1/3" />
                  <div className="h-4 bg-[#153052] [.light_&]:bg-slate-200 rounded-md w-3/4" />
                  <div className="h-3 bg-[#153052] [.light_&]:bg-slate-200 rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredMemories.length > 0 ? (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 sm:gap-6 space-y-4 sm:space-y-6">
            {filteredMemories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                albumName={memory.albumId ? albumMap.get(memory.albumId) : undefined}
                onClick={handleCardClick}
              />
            ))}
          </div>
        ) : allMemories.length > 0 ? (
          /* Filtered empty state */
          <div className="my-16 max-w-md mx-auto text-center p-8 night-card rounded-3xl animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-[#0B1D35] [.light_&]:bg-sky-50 border border-[var(--border-subtle)] text-[#A9D6F5] [.light_&]:text-sky-600 flex items-center justify-center mx-auto mb-3">
              {activeTypeFilter === 'video' ? (
                <Film className="w-7 h-7" />
              ) : (
                <ImageIcon className="w-7 h-7" />
              )}
            </div>
            <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
              No {activeTypeFilter === 'video' ? 'videos' : activeTypeFilter === 'photo' ? 'photos' : 'moments'} found
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-[var(--text-secondary)] font-light">
              There are currently no items matching your selected filter.
            </p>
            <button
              onClick={() => {
                setActiveTypeFilter('all');
                setActiveAlbumId(null);
              }}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-night-primary text-xs cursor-pointer"
            >
              <span>View All Moments</span>
            </button>
          </div>
        ) : (
          /* Initial empty state */
          <div className="my-16 max-w-md mx-auto text-center p-8 night-card rounded-3xl animate-fade-in">
            <div className="flex justify-center mb-3">
              <TeddyBearToy className="w-20 h-20 animate-moon-float" />
            </div>
            <h3 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Your little memories are waiting here.
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)] font-light leading-relaxed">
              Start adding photos and videos from Family Admin to fill this album with precious moments.
            </p>
            <button
              onClick={() => navigate('/familyadmin/upload')}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl btn-night-primary text-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add First Memory</span>
            </button>
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      <Lightbox
        memory={activeLightboxMemory}
        memoriesList={filteredMemories}
        albums={albums}
        onClose={() => setActiveLightboxMemory(null)}
        onNavigate={handleLightboxNavigate}
      />
    </div>
  );
};
