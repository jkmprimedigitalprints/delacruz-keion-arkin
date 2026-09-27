import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { verifyAdminPin } from '../supabase/auth';
import { AdminAuthState } from '../types';

interface AdminLoginProps {
  navigate: (path: string) => void;
  authState: AdminAuthState;
}

const PIN_LENGTH = 6;

export const AdminLogin: React.FC<AdminLoginProps> = ({ navigate, authState }) => {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (authState.isAuthenticated) {
      navigate('/familyadmin/dashboard');
    }
  }, [authState.isAuthenticated, navigate]);

  // Keep input focused automatically
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH); // Digits only, max 6
    setPin(rawVal);
    setErrorMessage('');

    if (rawVal.length === PIN_LENGTH) {
      submitPin(rawVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (pin.length === PIN_LENGTH) {
        submitPin(pin);
      } else {
        setErrorMessage(`Please enter all ${PIN_LENGTH} digits`);
      }
    }
  };

  const submitPin = async (inputPin: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await verifyAdminPin(inputPin);
      if (result.success) {
        navigate('/familyadmin/dashboard');
      } else {
        setErrorMessage(result.error || 'Incorrect PIN. Access denied.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPin('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      setErrorMessage('Verification failed. Try again.');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === PIN_LENGTH) {
      submitPin(pin);
    } else {
      setErrorMessage(`Please enter all ${PIN_LENGTH} digits`);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="min-h-[80vh] flex items-center justify-center px-4 py-12"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        className={`max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-sky-100 transition-transform ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-sky-200 mb-4">
            <Shield className="w-7 h-7" />
          </div>

          <h2 className="font-serif text-2xl font-bold text-slate-900">
            Family Admin
          </h2>
          <p className="mt-1 text-xs text-slate-500 font-light">
            Type your 6-digit PIN on your keyboard to unlock.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-6">
          {/* Transparent full-width overlay input to reliably capture keyboard events on all devices */}
          <div className="relative mb-4 cursor-pointer" onClick={() => inputRef.current?.focus()}>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus
              value={pin}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              maxLength={PIN_LENGTH}
              disabled={isLoading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              aria-label="Enter 6-digit admin PIN"
            />

            {/* Visual 6-Digit Boxes */}
            <div className="flex justify-center gap-2 sm:gap-2.5">
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const isFilled = index < pin.length;
                const isCurrent = index === pin.length && !isLoading;
                return (
                  <div
                    key={index}
                    className={`w-11 h-14 sm:w-12 sm:h-15 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-all duration-150 ${
                      isFilled
                        ? 'border-sky-500 bg-sky-50/70 text-sky-800 scale-105 shadow-xs'
                        : isCurrent
                        ? 'border-sky-400 bg-white ring-4 ring-sky-100 animate-pulse'
                        : 'border-slate-200 bg-slate-50 text-slate-300'
                    }`}
                  >
                    {isFilled ? '•' : ''}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center mb-5">
            Enter your 6-digit Family Admin PIN and press{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-600 font-mono">
              Enter
            </kbd>
          </p>

          {errorMessage && (
            <p className="text-xs text-rose-600 text-center font-medium mb-4 flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </p>
          )}

          {/* Unlock Button */}
          <button
            type="submit"
            disabled={isLoading || pin.length !== PIN_LENGTH}
            className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm shadow-md shadow-sky-200 flex items-center justify-center gap-2 transition"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Unlocking...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Unlock Admin</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
