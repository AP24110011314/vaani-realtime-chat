export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null

  const types = {
    info: 'bg-slate-800 border-slate-700 text-slate-200',
    success: 'bg-emerald-950/80 border-emerald-700 text-emerald-200',
    error: 'bg-rose-950/80 border-rose-700 text-rose-200',
    warning: 'bg-amber-950/80 border-amber-700 text-amber-200',
  }

  return (
    <div
      role="alert"
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 ${types[type] || types.info}`}
    >
      <span className="text-sm font-medium">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg"
          aria-label="Close"
        >
          &times;
        </button>
      )}
    </div>
  )
}
