export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-[3px]',
    xl: 'w-14 h-14 border-4',
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-block rounded-full animate-spin border-t-transparent border-[var(--accent-solid)] ${sizes[size] || sizes.md} ${className}`}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}
