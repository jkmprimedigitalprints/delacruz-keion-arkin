import React, { useState, useEffect } from 'react';
import {
  listenToBabySettings,
  saveBabySettings,
} from '../supabase/database';
import { BabySettings } from '../types';
import {
  Settings,
  Sparkles,
  Calendar,
  Heart,
  Save,
  Check,
  ArrowLeft,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '../components/Toast';

interface AdminSettingsProps {
  navigate: (path: string) => void;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ navigate }) => {
  const { showToast } = useToast();

  const [babyName, setBabyName] = useState('KEION ARKIN DE LA CRUZ');
  const [birthDate, setBirthDate] = useState('2025-10-12');
  const [heroQuote, setHeroQuote] = useState('Little moments, Big memories');
  const [heroSubtitle, setHeroSubtitle] = useState(
    'Every little smile, crawl, and giggle becomes a treasure worth keeping forever.'
  );
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = listenToBabySettings((settings) => {
      setBabyName(settings.babyName || 'KEION ARKIN DE LA CRUZ');
      setBirthDate(settings.birthDate || '2025-10-12');
      setHeroQuote(settings.heroQuote || 'Little moments, Big memories');
      setHeroSubtitle(settings.heroSubtitle || '');
      setCoverPhotoUrl(settings.coverPhotoUrl || '');
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!babyName.trim()) {
      showToast('Baby name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await saveBabySettings({
        babyName: babyName.trim(),
        birthDate: birthDate.trim(),
        heroQuote: heroQuote.trim(),
        heroSubtitle: heroSubtitle.trim(),
        coverPhotoUrl: coverPhotoUrl.trim() || null,
      });

      showToast('Baby profile settings updated! All devices synced.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[85vh]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-200/80">
        <button
          onClick={() => navigate('/familyadmin/dashboard')}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200 transition"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900">
            Baby Profile & Album Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure the public hero title, birthdate, and sentimental quotes.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading settings...</div>
      ) : (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6"
        >
          {/* Baby Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Baby Full Name *
            </label>
            <input
              type="text"
              required
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
              placeholder="e.g. Keion Arkin"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
          </div>

          {/* Birth Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-500" />
              <span>Date of Birth</span>
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Used to calculate and display baby age (e.g. "4 months old") dynamically in the hero.
            </p>
          </div>

          {/* Hero Quote */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>Hero Headline Quote</span>
            </label>
            <input
              type="text"
              value={heroQuote}
              onChange={(e) => setHeroQuote(e.target.value)}
              placeholder="e.g. Little moments, Big memories"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
          </div>

          {/* Hero Subtitle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Hero Story Subtitle
            </label>
            <textarea
              rows={3}
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
              placeholder="Every little smile, crawl, and giggle becomes a treasure worth keeping forever."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
          </div>

          {/* Profile Avatar / Cover URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-sky-500" />
              <span>Cover Photo / Avatar URL (Optional)</span>
            </label>
            <input
              type="url"
              value={coverPhotoUrl}
              onChange={(e) => setCoverPhotoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-200 transition"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-md shadow-sky-200 flex items-center gap-2 transition"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
