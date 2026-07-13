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
        className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleLogout}
        type="button"
      >
        {isSigningOut ? signingOutLabel : label}
      </button>
      {feedbackMessage ? (
        <p className="mt-2 text-sm text-rose-700" aria-live="polite">
          {feedbackMessage}
        </p>
      ) : null}
    </div>
  );
}