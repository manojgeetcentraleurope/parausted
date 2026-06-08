'use client';


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';


import type { Messages } from '@/lib/i18n/messages';
import { supabaseBrowserClient } from '@/lib/supabase/client';

type LoginFormProps = {
  messages: Messages;
  nextPath: string;
  signupPath: string;
};

type LoadingAction = 'password' | 'magic' | 'google' | null;
type Feedback = { kind: 'error' | 'success'; message: string } | null;

const inputClassName =
  'mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10';
const primaryButtonClassName =
  'inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonClassName =
  'inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60';
const spinnerClassName =
  'h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent';

function buildAuthCallbackUrl(nextPath: string): string {
  const callbackUrl = new URL('/auth/callback', window.location.origin);
  callbackUrl.searchParams.set('next', nextPath);
  return callbackUrl.toString();
}

function renderButtonLabel(label: string, isLoading: boolean): ReactNode {
  if (!isLoading) {
    return <>{label}</>;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={spinnerClassName} aria-hidden="true" />
      {label}
    </span>
  );
}

export function LoginForm({ messages, nextPath, signupPath }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const normalizedEmail = email.trim();
  const isLoading = loadingAction !== null;
  const passwordLoginDisabled = isLoading || normalizedEmail.length === 0 || password.length === 0;
  const magicLinkDisabled = isLoading || normalizedEmail.length === 0;
  const router = useRouter();

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!normalizedEmail || password.length === 0) {
      setFeedback({ kind: 'error', message: messages.auth.genericError });
      return;
    }

    setLoadingAction('password');
    setFeedback(null);

    try {
      const { error } = await supabaseBrowserClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setFeedback({ kind: 'error', message: messages.auth.genericError });
        return;
      }

      
router.push(nextPath);
router.refresh();

    } catch {
      setFeedback({ kind: 'error', message: messages.auth.genericError });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleMagicLinkClick() {
    if (!normalizedEmail) {
      setFeedback({ kind: 'error', message: messages.auth.genericError });
      return;
    }

    setLoadingAction('magic');
    setFeedback(null);

    try {
      const { error } = await supabaseBrowserClient.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(nextPath),
        },
      });

      if (error) {
        setFeedback({ kind: 'error', message: messages.auth.genericError });
        return;
      }

      setFeedback({ kind: 'success', message: messages.auth.checkYourEmail });
    } catch {
      setFeedback({ kind: 'error', message: messages.auth.genericError });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleGoogleLogin() {
    setLoadingAction('google');
    setFeedback(null);

    try {
      const { error } = await supabaseBrowserClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildAuthCallbackUrl(nextPath),
        },
      });

      if (error) {
        setFeedback({ kind: 'error', message: messages.auth.genericError });
      }
    } catch {
      setFeedback({ kind: 'error', message: messages.auth.genericError });
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handlePasswordLogin}>
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700">
          {messages.common.appName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {messages.auth.loginTitle}
        </h1>
        <p className="text-sm leading-6 text-slate-600">{messages.seo.defaultDescription}</p>
      </div>

      {feedback ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.kind === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="login-email">
          {messages.auth.emailLabel}
        </label>
        <input
          id="login-email"
          className={inputClassName}
          type="email"
          autoComplete="email"
          inputMode="email"
          name="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFeedback(null);
          }}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
          {messages.auth.passwordLabel}
        </label>
        <input
          id="login-password"
          className={inputClassName}
          type="password"
          autoComplete="current-password"
          name="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setFeedback(null);
          }}
        />
      </div>

      <button className={primaryButtonClassName} disabled={passwordLoginDisabled} type="submit">
        {renderButtonLabel(messages.auth.loginWithPassword, loadingAction === 'password')}
      </button>

      <button
        className={secondaryButtonClassName}
        disabled={magicLinkDisabled}
        type="button"
        onClick={handleMagicLinkClick}
      >
        {renderButtonLabel(messages.auth.sendMagicLink, loadingAction === 'magic')}
      </button>

      <button
        className={secondaryButtonClassName}
        disabled={isLoading}
        type="button"
        onClick={handleGoogleLogin}
      >
        {renderButtonLabel(messages.auth.continueWithGoogle, loadingAction === 'google')}
      </button>

      <p className="pt-2 text-sm text-slate-600">
        {messages.auth.needAccount}{' '}
        <Link className="font-semibold text-cyan-700 underline-offset-4 hover:underline" href={signupPath}>
          {messages.auth.createAccount}
        </Link>
      </p>
    </form>
  );
}