import { Link } from 'react-router'
import Button from '../components/common/Button'
import VanniLogo from '../components/common/VanniLogo'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen text-ink flex flex-col items-center justify-center p-6 text-center">
      <div className="glass-strong rounded-[28px] p-8 sm:p-10 max-w-md w-full flex flex-col items-center animate-modal-in">
        <div className="mb-5">
          <VanniLogo size="md" />
        </div>
        <div className="px-4 py-1.5 rounded-full bg-[var(--accent-soft-bg)] border border-[var(--accent-soft-border)] text-sm font-bold text-accent-text tabular-nums mb-4">
          404
        </div>
        <h1 className="text-3xl font-bold tracking-tight heading-tight mb-2">
          Page Not Found
        </h1>
        <p className="text-ink-muted text-sm max-w-xs mb-6 leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link to="/app">
          <Button className="rounded-full px-6">Return to Vanni</Button>
        </Link>
      </div>
    </div>
  )
}
