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
          className="text-xs font-semibold text-ink-muted uppercase tracking-wider"
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
          className={`w-full glass-input rounded-2xl px-4 py-2.5 text-sm ${
            error
              ? 'border-[var(--danger-border)] focus:border-[var(--danger-solid)]'
              : ''
          } ${rightElement ? 'pr-11' : ''} ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center text-ink-muted hover:text-ink">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-[var(--danger-text)] font-medium mt-0.5">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-xs text-ink-subtle mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  )
})

export default Input
