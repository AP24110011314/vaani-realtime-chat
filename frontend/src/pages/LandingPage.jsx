import { Link } from 'react-router'
import Button from '../components/common/Button'
import VanniLogo from '../components/common/VanniLogo'
import { MessageSquare, ShieldCheck, Zap, Globe, CheckCheck } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen text-ink flex flex-col">
      {/* Floating Glass Navbar */}
      <header className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-6xl mx-auto w-full">
        <nav className="glass rounded-full px-5 py-3 flex items-center justify-between">
          <Link to="/" className="focus-accent rounded-xl">
            <VanniLogo size="md" />
          </Link>

          <div className="flex items-center gap-2.5">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="rounded-full">
                Log in
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" size="sm" className="rounded-full px-4">
                Sign up
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 py-12 lg:py-16 max-w-6xl mx-auto w-full">
        {/* Hero Split Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-subtle text-accent-text text-xs font-semibold uppercase tracking-wider mb-6">
              <Zap className="w-3.5 h-3.5" />
              <span>Real-time Web Chat</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink heading-tight mb-6 leading-[1.08]">
              Real-time conversations,{' '}
              <span className="text-gradient-accent">
                zero installation.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-ink-muted max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              Vanni is a web-only chat platform built for calm focus and speed in your
              browser. Connect instantly with one-to-one and group messaging, live
              presence, and hardened security.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
              <Link to="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto px-7 rounded-full">
                  Get Started Free &rarr;
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto px-7 rounded-full">
                  Sign In to Your Account
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Live-Looking Glass Chat Preview */}
          <div className="lg:col-span-5" aria-hidden="true">
            <div className="glass-strong rounded-[28px] p-4 sm:p-5 space-y-4">
              {/* Mock header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--glass-border)]">
                <div className="flex items-center gap-3">
                  <div className="p-[2px] rounded-full accent-ring">
                    <div className="w-9 h-9 rounded-full bg-[var(--presence-ring-bg)] flex items-center justify-center">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #0D9488 0%, #0284C7 100%)' }}
                      >
                        AV
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink leading-tight">Asha Verma</p>
                    <p className="text-[11px] font-semibold text-[var(--success-text)]">Online now</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full glass-subtle text-[10px] font-semibold text-ink-muted">
                  Live STOMP
                </span>
              </div>

              {/* Mock message thread */}
              <div className="space-y-2.5">
                <div className="flex justify-start">
                  <div className="max-w-[82%] px-3.5 py-2.5 rounded-[20px] rounded-tl-[6px] bubble-received text-[14px]">
                    <p>Hey! Just opened the Vanni workspace in my browser.</p>
                    <div className="text-[10px] text-ink-subtle text-right mt-1 tabular-nums">10:41</div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="max-w-[82%] px-3.5 py-2.5 rounded-[20px] rounded-br-[6px] bubble-sent text-[14px]">
                    <p>Instant sync &mdash; receipts and typing indicators work live too.</p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-[var(--bubble-sent-meta)] mt-1 tabular-nums">
                      <span>10:42</span>
                      <CheckCheck className="w-3.5 h-3.5 opacity-95" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-start">
                  <div className="px-3.5 py-2 rounded-[20px] rounded-tl-[6px] bubble-received inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] animate-typing-dot" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] animate-typing-dot [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-solid)] animate-typing-dot [animation-delay:300ms]" />
                  </div>
                </div>
              </div>

              {/* Mock floating composer pill */}
              <div className="glass-subtle rounded-full px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-ink-subtle">Type a message...</span>
                <span className="w-7 h-7 rounded-full accent-badge flex items-center justify-center text-xs font-bold">
                  &rarr;
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards in Glass */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full mt-16">
          <div className="p-6 rounded-3xl glass">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] flex items-center justify-center text-accent-text mb-4">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-ink mb-1.5">Browser Only</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Works seamlessly on any desktop or laptop browser without mobile or
              desktop installers.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] flex items-center justify-center text-accent-text mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-ink mb-1.5">STOMP Real-Time</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              Sub-second message delivery with personal fan-out queues and live
              read status.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] flex items-center justify-center text-accent-text mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-ink mb-1.5">Hardened Security</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              HttpOnly JWTs, rotating refresh tokens, CSRF protection, and
              BCrypt(12) password hashing.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-ink-subtle">
        &copy; {new Date().getFullYear()} Vanni. All rights reserved.
      </footer>
    </div>
  )
}
