import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  {
    label,
    id,
    type = 'text',
    error,
    helperText,
    className = '',
    rightElement,
    ...props
  },
  ref
) {
  const inputId = id || props.name

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-150 ${
            error
              ? 'border-rose-500/70 focus:ring-rose-500/40 focus:border-rose-500'
              : 'border-slate-700/80 focus:ring-indigo-500/40 focus:border-indigo-500'
          } ${rightElement ? 'pr-11' : ''} ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center text-slate-400 hover:text-slate-200">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-rose-400 font-medium mt-0.5">{error}</p>
      )}

      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-slate-500 mt-0.5">{helperText}</p>
      )}
    </div>
  )
})

export default Input
