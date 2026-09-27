import React from 'react';
import { Calendar, Heart, Sparkles } from 'lucide-react';
import { BabySettings } from '../types';
import { HeroBabyToysOverlay } from './BabyToysBackground';

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

  return (
    <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-sky-50/70 via-[#F8FAFC] to-[#F8FAFC] border-b border-sky-100/50">
      {/* Subtle background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-radial from-sky-200/30 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Cute Baby Toys & Nursery Accents Background Overlay */}
      <HeroBabyToysOverlay />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
        {/* Baby profile cover/avatar if available */}
        {settings.coverPhotoUrl ? (
          <div className="relative inline-block mb-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-sky-300 via-blue-200 to-sky-400 shadow-md shadow-sky-100">
              <img
                src={settings.coverPhotoUrl}
                alt={settings.babyName}
                className="w-full h-full object-cover rounded-full bg-sky-50"
              />
            </div>
            <span className="absolute bottom-0 right-0 p-1.5 bg-white text-sky-500 rounded-full shadow-xs border border-sky-100">
              <Heart className="w-3.5 h-3.5 fill-sky-400 text-sky-400" />
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-sky-200 text-sky-700 text-xs font-semibold tracking-wide uppercase shadow-xs mb-4">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Digital Keepsake</span>
          </div>
        )}

        {/* Baby Name Title */}
        <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 leading-tight">
          {settings.babyName || 'KEION ARKIN DE LA CRUZ'}
        </h1>

        {/* Birthdate & Age badge */}
        {settings.birthDate && (
          <div className="inline-flex items-center gap-2 mt-3 text-xs sm:text-sm font-medium text-slate-500 bg-white/80 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-sky-500" />
            <span>Born {new Date(settings.birthDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            {ageText && (
              <>
                <span className="w-1 h-1 rounded-full bg-sky-300"></span>
                <span className="text-sky-600 font-semibold">{ageText}</span>
              </>
            )}
          </div>
        )}

        {/* Sentimental Quote */}
        <blockquote className="mt-5 max-w-xl mx-auto font-serif italic text-lg sm:text-xl text-slate-700">
          “{settings.heroQuote || 'Little Moments, Big Memories'}”
        </blockquote>

        <p className="mt-2 text-sm sm:text-base text-slate-500 max-w-lg mx-auto font-light leading-relaxed">
          {settings.heroSubtitle ||
            'Every little moment becomes a memory worth keeping forever.'}
        </p>

        {/* Stat badges */}
        <div className="mt-7 flex items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-slate-600">
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
            <span className="font-bold text-slate-800">{totalMemories}</span> Memories
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
            <span className="font-bold text-sky-600">{totalPhotos}</span> Photos
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
            <span className="font-bold text-blue-600">{totalVideos}</span> Videos
          </div>
        </div>
      </div>
    </section>
  );
};
