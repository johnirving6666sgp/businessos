export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  pill = false,
  className = '',
  icon,
  ...props
}) {
  const radius = pill ? 'rounded-full' : 'rounded-xl'
  const base = `inline-flex items-center justify-center gap-1.5 font-medium ${radius} transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed select-none`

  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 active:bg-slate-100',
    ghost: 'text-slate-500 hover:bg-slate-100 active:bg-slate-200',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
    agent: 'bg-violet-500 text-white hover:bg-violet-600 active:bg-violet-700',
  }

  const sizes = {
    sm: 'text-sm px-3.5 py-1.5 h-8',
    md: 'text-sm px-4 py-2 h-9',
    lg: 'text-base px-5 py-2.5 h-11',
    icon: 'w-9 h-9 p-2',
    'icon-sm': 'w-7 h-7 p-1.5',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading
        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : icon}
      {children}
    </button>
  )
}
