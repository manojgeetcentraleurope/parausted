'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Locale } from '@/lib/i18n/config';
import { supabaseBrowserClient } from '@/lib/supabase/client';

type LogoutButtonProps = {
  locale: Locale;
  label: string;
  signingOutLabel: string;
};

const FALLBACK_COPY: Record<Locale, string> = {
  es: 'No se pudo cerrar sesión. Intenta de nuevo.',
  en: 'Could not sign out. Please try again.',
};

export function LogoutButton({ locale, label, signingOutLabel }: LogoutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleLogout = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setFeedbackMessage(null);

    try {
      const { error } = await supabaseBrowserClient.auth.signOut();

      if (error) {
        setFeedbackMessage(FALLBACK_COPY[locale]);
      }
    } catch {
      setFeedbackMessage(FALLBACK_COPY[locale]);
    } finally {
      router.push(`/${locale}/login`);
      router.refresh();
      setIsSigningOut(false);
    }
  };

  return (
    <div>
      <button
        aria-busy={isSigningOut}
        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleLogout}
        type="button"
      >
        {isSigningOut ? signingOutLabel : label}
      </button>
      <p className="mt-2 min-h-5 text-sm text-rose-700" aria-live="polite">
        {feedbackMessage}
      </p>
    </div>
  );
}