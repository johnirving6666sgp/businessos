import { useAuthStore } from '../../store/auth.js'

const BOTTOM_ITEMS = [
  { id: 'dashboard', icon: '⬛', label: '工作台' },
  { id: 'chat', icon: '💬', label: 'Agent', perm: 'agents' },
  { id: 'opportunities', icon: '🔍', label: '线索' },
  { id: 'customers', icon: '👥', label: '客户', perm: 'customers' },
  { id: 'tasks', icon: '✅', label: '任务', perm: 'tasks' },
]

export function BottomNav({ currentPage, onNavigate }) {
  const can = useAuthStore(s => s.can)
  const items = BOTTOM_ITEMS.filter(item => !item.perm || can(item.perm))

  return (
    <nav className="flex items-center justify-around px-2 py-1 safe-area-bottom">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-0 ${
            currentPage === item.id
              ? 'text-blue-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
