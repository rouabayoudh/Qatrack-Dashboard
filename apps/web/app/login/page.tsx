'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import type { LoginDTO, AuthResponse } from '@qatrack/shared-types';

/* ─────────────── Inline SVG Icons ─────────────── */

function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
    </svg>
  );
}

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M6.99 11 3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z" />
    </svg>
  );
}

/* ─────────────── Login Page Component ─────────────── */

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  const [jiraDomain, setJiraDomain] = useState('');
  const [showDomainField, setShowDomainField] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  function handleJiraSignIn() {
    window.location.href = `${API_BASE}/jira/connect`;
  }

  /* ── Card tilt micro-animation (desktop only) ── */
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    function handleMouseMove(e: MouseEvent) {
      if (window.innerWidth < 1024) return;
      const xAxis = (window.innerWidth / 2 - e.pageX) / 100;
      const yAxis = (window.innerHeight / 2 - e.pageY) / 100;
      card!.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    }

    function handleMouseLeave() {
      card!.style.transform = 'rotateY(0deg) rotateX(0deg)';
      card!.style.transition = 'all 0.5s ease';
    }

    function handleCardEnter() {
      card!.style.transition = 'none';
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    card.addEventListener('mouseenter', handleCardEnter);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      card.removeEventListener('mouseenter', handleCardEnter);
    };
  }, []);

  /* ── Form submission ── */
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter your Jira API Token or password.');
      setIsLoading(false);
      return;
    }

    const body: LoginDTO = {
      email: email.trim(),
      password,
      jiraDomain: jiraDomain.trim() || undefined,
      rememberMe,
    };

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = 'Invalid credentials or unable to sign in with Jira.';
        try {
          const errData = await res.json();
          if (errData?.message) {
            msg = Array.isArray(errData.message) ? errData.message.join(', ') : errData.message;
          }
        } catch {
          const text = await res.text().catch(() => '');
          if (text) msg = text;
        }
        setError(msg);
        return;
      }

      const data: AuthResponse = await res.json();
      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Unable to reach the server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-gutter">
      {/* ── Background Decoration ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute -top-[10%] -left-[5%] w-[40%] h-[40%] rounded-full bg-surface-container-high blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[5%] w-[40%] h-[40%] rounded-full bg-secondary-container blur-[120px]" />
      </div>

      {/* ── Main Content ── */}
      <main className="relative w-full max-w-[440px] z-10">
        {/* ── Brand Identity ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-lg bg-primary overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-80" />
              <AnalyticsIcon className="text-white relative z-10" />
            </div>
            <h1 className="font-semibold text-2xl leading-8 tracking-tight text-on-background">
              QATrack
            </h1>
          </div>
          <p className="text-sm leading-5 text-on-surface-variant">
            Enterprise Quality Management Suite
          </p>
        </div>

        {/* ── Login Card ── */}
        <div
          ref={cardRef}
          className="bg-surface-container-lowest rounded-xl p-8 space-y-6 border border-[#E5E7EB]"
          style={{
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
            transform: 'rotateY(0deg) rotateX(0deg)',
            transition: '0.5s',
          }}
        >
          {/* ── SSO Button ── */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleJiraSignIn}
              className="w-full h-12 flex items-center justify-center gap-3 bg-primary-container text-white rounded-lg font-semibold text-base leading-6 transition-all duration-200 hover:bg-primary active:scale-[0.98] cursor-pointer"
            >
              <SyncIcon />
              Open Jira
            </button>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-error-container/40 border border-error/20 px-4 py-3 text-[13px] leading-[18px] text-on-error-container">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="18"
                  height="18"
                  className="shrink-0 text-error mt-0.5"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* ── Divider ── */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-outline-variant" />
              <span className="text-xs leading-4 tracking-[0.02em] font-medium text-outline uppercase">
                or sign in with Jira credentials
              </span>
              <div className="flex-1 h-px bg-outline-variant" />
            </div>

            {/* ── Jira Credentials Form ── */}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="block text-xs leading-4 tracking-[0.02em] font-medium text-on-surface-variant"
                >
                  Jira Account Email
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                    <MailIcon />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 h-10 bg-white border border-outline-variant rounded-lg text-sm leading-5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline-variant disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="login-password"
                    className="block text-xs leading-4 tracking-[0.02em] font-medium text-on-surface-variant"
                  >
                    Jira API Token / Password
                  </label>
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs leading-4 tracking-[0.02em] font-medium text-primary hover:underline transition-all"
                  >
                    Get API Token ↗
                  </a>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                    <LockIcon />
                  </span>
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 h-10 bg-white border border-outline-variant rounded-lg text-sm leading-5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline-variant disabled:opacity-60"
                  />
                </div>
                
              </div>

              {/* Optional Jira Domain Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDomainField(!showDomainField)}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>{showDomainField ? '− Hide Jira Domain' : '+ Specify Jira Domain / URL (optional)'}</span>
                </button>

                {showDomainField && (
                  <div className="space-y-1.5 mt-2">
                    <label
                      htmlFor="login-domain"
                      className="block text-xs leading-4 tracking-[0.02em] font-medium text-on-surface-variant"
                    >
                      Jira Site Domain
                    </label>
                    <input
                      id="login-domain"
                      type="text"
                      placeholder="e.g. your-company.atlassian.net"
                      value={jiraDomain}
                      onChange={(e) => setJiraDomain(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 h-9 bg-white border border-outline-variant rounded-lg text-xs leading-5 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline-variant disabled:opacity-60"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="login-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-primary border-outline-variant rounded focus:ring-primary accent-primary cursor-pointer"
                />
                <label
                  htmlFor="login-remember"
                  className="text-[13px] leading-[18px] text-on-surface-variant cursor-pointer"
                >
                  Keep me logged in for 30 days
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-2 bg-primary text-white font-semibold text-sm leading-6 rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    Verifying credentials…
                  </>
                ) : (
                  'Sign In with Jira Credentials'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Footer Links ── */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-[13px] leading-[18px] text-on-surface-variant">
            New to QATrack?{' '}
            <a href="#" className="text-primary font-semibold hover:underline">
              Learn how to get started with QATrack.
            </a>
          </p>

        </div>
      </main>

      {/* ── Right-side Accent Panel (desktop) ── */}
      <div className="hidden lg:flex fixed top-0 bottom-0 right-0 w-1/3 p-gutter items-center justify-center" />
    </div>
  );
}
