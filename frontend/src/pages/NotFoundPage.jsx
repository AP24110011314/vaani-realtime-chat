import { Link } from 'react-router'
import Button from '../components/common/Button'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl font-bold text-indigo-400 mb-4">
        404
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">
        Page Not Found
      </h1>
      <p className="text-slate-400 text-sm max-w-sm mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/app">
        <Button>Return to Vanni</Button>
      </Link>
    </div>
  )
}
