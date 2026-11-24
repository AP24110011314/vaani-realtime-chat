import { Link } from 'react-router'
import Button from '../components/common/Button'
import { MessageSquare, ShieldCheck, Zap, Globe } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <nav className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/30">
            V
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Vanni
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link to="/register">
            <Button variant="primary" size="sm">
              Sign up
            </Button>
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <Zap className="w-3.5 h-3.5" />
          Real-time Web Chat
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
          Real-time conversations,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            zero installation.
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Vanni is a web-only chat platform built for pure performance in your
          browser. Connect instantly with one-to-one and group messaging, live
          presence, and secure credentials.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link to="/register">
            <Button size="lg" className="px-8 shadow-indigo-600/30">
              Get Started Free &rarr;
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="lg" className="px-8">
              Sign In to Your Account
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full mt-4">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <Globe className="w-7 h-7 text-indigo-400 mb-3" />
            <h2 className="font-semibold text-white mb-1">Browser Only</h2>
            <p className="text-sm text-slate-400">
              Works seamlessly on any desktop or laptop browser without mobile or
              desktop installers.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <MessageSquare className="w-7 h-7 text-indigo-400 mb-3" />
            <h2 className="font-semibold text-white mb-1">STOMP Real-Time</h2>
            <p className="text-sm text-slate-400">
              Sub-second message delivery with personal fan-out queues and live
              read status.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
            <ShieldCheck className="w-7 h-7 text-indigo-400 mb-3" />
            <h2 className="font-semibold text-white mb-1">Hardened Security</h2>
            <p className="text-sm text-slate-400">
              HttpOnly JWTs, rotating refresh tokens, CSRF protection, and
              BCrypt(12) password hashing.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} Vanni. All rights reserved.
      </footer>
    </div>
  )
}
