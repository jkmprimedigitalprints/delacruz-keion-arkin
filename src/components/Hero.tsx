import React from 'react';
import { Calendar, Heart, ArrowDown } from 'lucide-react';
import { BabySettings } from '../types';
import { HeroBabyToysOverlay, TinySparkleSvg } from './BabyToysBackground';

interface HeroProps {
  settings: BabySettings;
  totalMemories: number;
  totalPhotos: number;
  totalVideos: number;
}

function calculateBabyAge(birthDateStr: string): string {
  try {
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return '';

    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const totalMonths = years * 12 + months;

    if (totalMonths === 0) {
      return `${days} ${days === 1 ? 'day' : 'days'} young`;
    } else if (totalMonths < 24) {
      if (days === 0) {
        return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'} old`;
      }
      return `${totalMonths} ${totalMonths === 1 ? 'month' : 'months'}, ${days}d old`;
    } else {
      return `${years} yrs, ${months} mos old`;
    }
  } catch {
    return '';
  }
}

export const Hero: React.FC<HeroProps> = ({
  settings,
  totalMemories,
  totalPhotos,
  totalVideos,
}) => {
  const ageText = settings.birthDate ? calculateBabyAge(settings.birthDate) : '';

  const handleScrollToMemories = () => {
    const galleryEl = document.getElementById('memories-gallery');
    if (galleryEl) {
      galleryEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollBy({ top: 420, behavior: 'smooth' });
    }
  };

  return (
    <section className="hero-anim-bg relative overflow-hidden pt-12 pb-14 sm:pt-16 sm:pb-20 border-b border-[var(--border-subtle)] bg-gradient-to-b from-[#0B1D35] via-[#071426] to-[var(--bg-primary)] [.light_&]:from-[#E6F1FB] [.light_&]:via-[#EFF6FC] [.light_&]:to-[#F4F8FC]">
      {/* Subtle Night Sky Overlay (Crescent Moon, Drifting Clouds, Twinkling Stars, Sparkles) */}
      <HeroBabyToysOverlay />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
        {/* Celestial Emblem: ✦  ☾  ✦ or Baby Cover Avatar */}
        <div className="hero-anim-sky mb-5 flex flex-col items-center justify-center">
          {settings.coverPhotoUrl ? (
            <div className="relative inline-block mb-3">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-[#6FA8DC] via-[#A9D6F5] to-[#F3C9D9] shadow-[0_0_30px_rgba(111,168,220,0.3)]">
                <img
                  src={settings.coverPhotoUrl}
                  alt={settings.babyName}
                  className="w-full h-full object-cover rounded-full bg-[#102642]"
                />
              </div>
              <span className="absolute bottom-0 right-0 p-1.5 bg-[#102642] text-[#F3C9D9] rounded-full shadow-xs border border-[#A9D6F5]/30">
                <Heart className="w-3.5 h-3.5 fill-[#F3C9D9] text-[#F3C9D9]" />
              </span>
            </div>
          ) : null}

          <div
            className="inline-flex items-center gap-4 text-[#A9D6F5] [.light_&]:text-[#3B82C4]"
            aria-hidden="true"
          >
            <TinySparkleSvg className="w-3.5 h-3.5 text-[#A9D6F5] animate-night-sparkle" />
            <span className="text-lg sm:text-xl leading-none text-[#D9ECFF] [.light_&]:text-[#2563EB] drop-shadow-[0_0_10px_rgba(217,236,255,0.45)]">
              ☾
            </span>
            <TinySparkleSvg
              className="w-3.5 h-3.5 text-[#F3C9D9] animate-night-sparkle"
              style={{ animationDelay: '1.6s' } as React.CSSProperties}
            />
          </div>
        </div>

        {/* Baby Name Title (400-900ms) */}
        <div className="hero-anim-name">
          <h1 className="font-serif text-3xl sm:text-5xl md:text-[3.35rem] font-semibold tracking-wide text-[var(--text-primary)] leading-tight text-balance drop-shadow-[0_2px_18px_rgba(111,168,220,0.14)]">
            {settings.babyName || 'KEION ARKIN DE LA CRUZ'}
          </h1>

          {/* Birthdate & Age line */}
          {settings.birthDate && (
            <div className="mt-3 inline-flex items-center justify-center flex-wrap gap-2 text-xs sm:text-sm text-[var(--text-secondary)]">
              <Calendar className="w-3.5 h-3.5 text-[#6FA8DC]" />
              <span>
                Born{' '}
                {new Date(settings.birthDate).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {ageText && (
                <>
                  <span aria-hidden="true" className="text-[#6FA8DC]/60">
                    ·
                  </span>
                  <span className="text-[#A9D6F5] [.light_&]:text-[#2563EB] font-medium">
                    {ageText}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sentimental Hero Quote (600-1100ms) */}
        <blockquote className="hero-anim-quote mt-6 max-w-xl mx-auto font-serif italic text-xl sm:text-2xl text-[#D9ECFF] [.light_&]:text-[#1E3A5F] leading-snug text-balance">
          “{settings.heroQuote || 'Little moments, Big memories'}”
        </blockquote>

        {/* Hero Subtitle (800-1300ms) */}
        <p className="hero-anim-subtitle mt-3 text-sm sm:text-base text-[var(--text-secondary)] max-w-lg mx-auto font-light leading-relaxed text-balance">
          {settings.heroSubtitle ||
            'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.'}
        </p>

        {/* CTA Button & Quiet Metadata Summary (1000-1500ms) */}
        <div className="hero-anim-cta mt-8 flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={handleScrollToMemories}
            className="btn-night-primary px-6 py-2.5 rounded-full text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer"
          >
            <span>View Memories</span>
            <ArrowDown className="w-4 h-4" />
          </button>

          {/* Clean unboxed keepsake counters */}
          <div className="flex items-center justify-center flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-[var(--text-muted)] tabular-nums">
            <span>
              <strong className="font-semibold text-[var(--text-primary)]">{totalMemories}</strong>{' '}
              Memories
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-[#A9D6F5] [.light_&]:text-[#2563EB]">
                {totalPhotos}
              </strong>{' '}
              Photos
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <strong className="font-semibold text-[#F3C9D9] [.light_&]:text-[#DB2777]">
                {totalVideos}
              </strong>{' '}
              Videos
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
