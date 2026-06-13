import { useUIStore } from '../../store/ui.js'

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const COLORS = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  info: 'bg-slate-800',
  warning: 'bg-amber-500',
}

export function ToastContainer() {
  const toasts = useUIStore(s => s.toasts)
  const dismiss = useUIStore(s => s.dismissToast)

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-6 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${COLORS[t.type] || COLORS.info} text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 pointer-events-auto fade-enter max-w-sm`}
          onClick={() => dismiss(t.id)}
        >
          <span className="text-base leading-none">{ICONS[t.type] || ICONS.info}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
