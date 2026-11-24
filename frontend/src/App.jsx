import { useState, useEffect } from 'react'
import axios from 'axios'

export default function App() {
  const [pingData, setPingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    axios
      .get('/api/ping')
      .then((res) => {
        setPingData(res.data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to backend')
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <header className="text-center max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl">
        <h1 className="text-4xl font-extrabold tracking-tight text-indigo-400 mb-2">
          Vanni
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          Real-Time Chat Web Application
        </p>

        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-700/60 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold text-slate-400">
              Backend Status (/api/ping)
            </span>
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                loading
                  ? 'bg-amber-400 animate-pulse'
                  : error
                    ? 'bg-red-500'
                    : 'bg-emerald-400'
              }`}
            />
          </div>

          {loading && (
            <p className="text-sm text-slate-400">Pinging backend proxy...</p>
          )}

          {error && (
            <p className="text-sm text-red-400 font-mono">Error: {error}</p>
          )}

          {pingData && (
            <pre className="text-xs font-mono text-emerald-300 bg-slate-900 p-3 rounded-lg overflow-x-auto border border-slate-800">
              {JSON.stringify(pingData, null, 2)}
            </pre>
          )}
        </div>

        <div className="mt-6 flex justify-between text-xs text-slate-500">
          <span>Phase 1: Project Setup</span>
          <span className="font-mono">Port 5173 &rarr; 8080</span>
        </div>
      </header>
    </div>
  )
}
