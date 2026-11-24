import { useAuth } from '../hooks/useAuth'
import Button from '../components/common/Button'
import { LogOut, ShieldCheck, CheckCircle2 } from 'lucide-react'

export default function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
            V
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              Vanni
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-400 font-mono">
              Web Chat
            </span>
          </div>
        </div>

        {/* User Chip & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"
                title="Online"
              />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {user?.name}
              </span>
              <span className="text-[11px] text-slate-400 leading-tight">
                {user?.email}
              </span>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-300 hover:text-rose-400 hover:border-rose-900/50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-6 flex flex-col justify-center items-center text-center">
        <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-6 text-indigo-400">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome to Vanni, {user?.name}!
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            Phase 2: Authentication is fully working. Your session is protected
            by HttpOnly cookies, rotating refresh tokens, and CSRF protection.
          </p>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 text-left mb-6 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Current Session Profile
            </h2>
            <div className="flex justify-between items-center text-sm border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">User ID</span>
              <span className="font-mono text-indigo-300">#{user?.id}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Email</span>
              <span className="text-slate-200">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Read Receipts</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Last Seen</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Visible
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 flex justify-between">
            <span>Ready for Phase 3: Direct Chat</span>
            <span className="font-mono">React 19 &bull; Spring Boot 4</span>
          </div>
        </div>
      </main>
    </div>
  )
}
