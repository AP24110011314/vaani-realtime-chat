import { Link } from 'react-router'
import Button from '../components/common/Button'
import VanniLogo from '../components/common/VanniLogo'
import {
  ShieldCheck,
  Zap,
  Globe,
  CheckCheck,
  Users,
  Image,
  Bell,
  Lock,
  UserPlus,
  Search,
  Send,
  ArrowRight,
  Star,
} from 'lucide-react'

/* ─── Feature list ─────────────────────────────────────────────────────── */
const features = [
  {
    icon: Globe,
    title: 'Browser-First',
    body: 'Works instantly on any modern browser — no installs, no updates, no friction.',
  },
  {
    icon: Zap,
    title: 'Real-Time STOMP',
    body: 'Sub-second delivery with personal fan-out queues and live read-status ticks.',
  },
  {
    icon: ShieldCheck,
    title: 'Hardened Security',
    body: 'HttpOnly JWTs, rotating refresh tokens, CSRF protection, and BCrypt-12 hashing.',
  },
  {
    icon: Users,
    title: 'Group Chats',
    body: 'Create rooms, manage members, admins, and watch system events appear live.',
  },
  {
    icon: Image,
    title: 'File Sharing',
    body: 'Send images and PDFs with a live progress bar. Preview right in the chat.',
  },
  {
    icon: Bell,
    title: 'Smart Presence',
    body: 'Online dots, last-seen timestamps, and live typing indicators — with privacy controls.',
  },
]

/* ─── How-it-works steps ───────────────────────────────────────────────── */
const steps = [
  {
    num: '01',
    icon: UserPlus,
    title: 'Create an account',
    body: 'Sign up in seconds — just your name, email, and a secure password.',
  },
  {
    num: '02',
    icon: Search,
    title: 'Find your contacts',
    body: 'Search by name or email to start a direct chat or invite people to a group.',
  },
  {
    num: '03',
    icon: Send,
    title: 'Start chatting',
    body: 'Send messages, share files, react with emoji, and stay in sync across tabs.',
  },
]

/* ─── Testimonials ─────────────────────────────────────────────────────── */
const testimonials = [
  {
    quote:
      'Vanni loads instantly and the glass UI actually makes me want to open it. Best web chat I have used.',
    name: 'Asha V.',
    role: 'Product Designer',
    initials: 'AV',
  },
  {
    quote:
      'Real-time receipts, group admin controls, file previews — it has everything we needed without the bloat.',
    name: 'Ravi M.',
    role: 'Engineering Lead',
    initials: 'RM',
  },
  {
    quote:
      'The reconnect handling is surprisingly solid. Even on a flaky connection messages arrive exactly once.',
    name: 'Priya S.',
    role: 'QA Engineer',
    initials: 'PS',
  },
]

/* ─── Component ────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen text-ink flex flex-col">

      {/* ── Sticky glass nav ── */}
      <div className="sticky top-0 z-40 px-4 sm:px-6 pt-4 sm:pt-6">
        <header className="max-w-6xl mx-auto">
          <nav className="glass rounded-full px-5 py-3 flex items-center justify-between">
            <Link to="/" className="focus-accent rounded-xl">
              <VanniLogo size="md" />
            </Link>

            <div className="flex items-center gap-2.5">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-full">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm" className="rounded-full px-5">
                  Get Started
                </Button>
              </Link>
            </div>
          </nav>
        </header>
      </div>

      <main className="flex-1 flex flex-col">

        {/* ─────────────────────────── HERO ───────────────────────────── */}
        <section className="px-4 sm:px-6 py-14 lg:py-20 max-w-6xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

            {/* Left copy */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-subtle text-accent-text text-xs font-semibold uppercase tracking-wider mb-6">
                <Zap className="w-3.5 h-3.5" />
                <span>Real-time Web Chat</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight text-ink heading-tight mb-6 leading-[1.07]">
                Conversations that{' '}
                <span className="text-gradient-accent">feel instant.</span>
              </h1>

              <p className="text-base sm:text-lg text-ink-muted max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
                Vanni is a browser-only chat platform built for calm focus and speed.
                One-to-one and group messaging, live presence, file sharing, and
                hardened security — zero installation required.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <Link to="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto px-7 rounded-full gap-2">
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto px-7 rounded-full">
                    Sign In to Your Account
                  </Button>
                </Link>
              </div>

              {/* Trust strip */}
              <div className="flex items-center justify-center lg:justify-start gap-5 mt-8 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-accent-text" />
                  HttpOnly cookies
                </span>
                <span className="w-px h-3 bg-[var(--glass-border)]" />
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent-text" />
                  CSRF protected
                </span>
                <span className="w-px h-3 bg-[var(--glass-border)]" />
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-accent-text" />
                  &lt;100 ms latency
                </span>
              </div>
            </div>

            {/* Right — live-looking chat mock */}
            <div className="lg:col-span-5" aria-hidden="true">
              <div className="glass-strong rounded-[28px] p-4 sm:p-5 space-y-4 animate-modal-in">

                {/* Mock header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--glass-border)]">
                  <div className="flex items-center gap-3">
                    <div className="p-[2px] rounded-full accent-ring">
                      <div className="w-9 h-9 rounded-full bg-[var(--presence-ring-bg)] flex items-center justify-center">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: 'linear-gradient(135deg, #0D9488 0%, #0284C7 100%)', color: '#fff' }}
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
                      <p>Instant sync — receipts and typing indicators work live too.</p>
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

                {/* Mock composer pill */}
                <div className="glass-subtle rounded-full px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-ink-subtle">Type a message...</span>
                  <span className="w-7 h-7 rounded-full accent-badge flex items-center justify-center text-xs font-bold">
                    &rarr;
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────── FEATURES GRID ──────────────────────── */}
        <section className="px-4 sm:px-6 py-14 max-w-6xl mx-auto w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-subtle text-accent-text text-xs font-semibold uppercase tracking-wider mb-4">
              <Star className="w-3.5 h-3.5" />
              <span>Everything you need</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-ink heading-tight mb-3">
              Built for real use,{' '}
              <span className="text-gradient-accent">not demos.</span>
            </h2>
            <p className="text-ink-muted max-w-lg mx-auto text-base leading-relaxed">
              Every feature is fully implemented, QA-tested, and running in production.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-6 rounded-3xl glass group hover:glass-row-hover transition-all duration-200">
                <div className="w-11 h-11 rounded-2xl bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] flex items-center justify-center text-accent-text mb-4 group-hover:scale-105 transition-transform duration-200">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-ink mb-1.5">{title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────────────────── HOW IT WORKS ─────────────────────────── */}
        <section className="px-4 sm:px-6 py-14 max-w-6xl mx-auto w-full">
          <div className="glass rounded-[32px] p-8 sm:p-12">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-ink heading-tight mb-3">
                Up and running in{' '}
                <span className="text-gradient-accent">60 seconds.</span>
              </h2>
              <p className="text-ink-muted max-w-md mx-auto text-base">
                No app store. No download. Just open your browser and start.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {steps.map(({ num, icon: Icon, title, body }, i) => (
                <div key={num} className="relative text-center">
                  {/* Connector line between steps on desktop */}
                  {i < steps.length - 1 && (
                    <div
                      className="hidden md:block absolute top-10 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] h-px"
                      style={{ background: 'linear-gradient(to right, var(--accent-soft-border), transparent)' }}
                    />
                  )}

                  <div className="inline-flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-3xl glass-strong flex items-center justify-center">
                        <Icon className="w-8 h-8 text-accent-text" />
                      </div>
                      <span
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center accent-badge"
                      >
                        {num.slice(1)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-ink mb-1">{title}</h3>
                      <p className="text-sm text-ink-muted leading-relaxed max-w-[200px] mx-auto">{body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/register">
                <Button size="lg" className="rounded-full px-8 gap-2">
                  Create Your Free Account
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ─────────────────────── TESTIMONIALS ───────────────────────── */}
        <section className="px-4 sm:px-6 py-14 max-w-6xl mx-auto w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink heading-tight mb-3">
              What people are saying
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map(({ quote, name, role, initials }) => (
              <div key={name} className="glass rounded-3xl p-6 flex flex-col gap-4">
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-[var(--accent-solid)] text-[var(--accent-solid)]" />
                  ))}
                </div>

                <p className="text-sm text-ink-muted leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>

                <div className="flex items-center gap-3 pt-2 border-t border-[var(--glass-border)]">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'linear-gradient(135deg, var(--accent-start) 0%, var(--accent-end) 100%)', color: 'var(--accent-ink)' }}
                  >
                    {initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink leading-tight">{name}</p>
                    <p className="text-xs text-ink-muted">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────────────── CTA BANNER ─────────────────────────── */}
        <section className="px-4 sm:px-6 pb-16 max-w-6xl mx-auto w-full">
          <div className="glass-strong rounded-[32px] px-8 py-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink heading-tight mb-4">
              Ready to chat?{' '}
              <span className="text-gradient-accent">Start now for free.</span>
            </h2>
            <p className="text-ink-muted mb-8 max-w-md mx-auto">
              Join thousands of users already on Vanni. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register">
                <Button size="lg" className="rounded-full px-8 gap-2">
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="lg" className="rounded-full px-8">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--glass-border)] px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="focus-accent rounded-xl">
            <VanniLogo size="sm" />
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-muted">
            <Link to="/login" className="hover:text-ink transition-colors focus-accent rounded">Sign In</Link>
            <Link to="/register" className="hover:text-ink transition-colors focus-accent rounded">Get Started</Link>
            <Link to="/privacy" className="hover:text-ink transition-colors focus-accent rounded">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-ink transition-colors focus-accent rounded">Terms of Service</Link>
          </nav>

          <p className="text-xs text-ink-muted">
            &copy; {new Date().getFullYear()} Vanni. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
