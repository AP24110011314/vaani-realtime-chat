import Spinner from './Spinner'

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  onClick,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-150 focus-accent active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const variants = {
    primary: 'btn-accent',
    secondary: 'btn-glass',
    outline:
      'bg-transparent hover:bg-[var(--glass-bg-hover)] text-ink border border-[var(--glass-border)]',
    ghost:
      'bg-transparent hover:bg-[var(--glass-bg-hover)] text-ink-muted hover:text-ink',
    danger:
      'bg-[var(--danger-solid)] hover:brightness-110 text-white shadow-md',
  }

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Spinner size="sm" className="border-current border-t-transparent" />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
