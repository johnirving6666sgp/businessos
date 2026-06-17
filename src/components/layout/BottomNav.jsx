import { useAuthStore } from '../../store/auth.js'
import { Icon } from '../ui/Icon.jsx'
import { BOTTOM_PRIMARY, BOTTOM_PRIMARY_RIGHT } from '../../config/navConfig.js'

// 移动端底部主导航：左二 + 中间 AI 大按钮 + 右一 + “更多”。
export function BottomNav({ currentPage, onNavigate, onOpenMore, moreActive }) {
  const can = useAuthStore(s => s.can)
  const canAgent = can('agents')
  const right = BOTTOM_PRIMARY_RIGHT.filter(i => !i.perm || can(i.perm))

  return (
    <nav className="flex items-end justify-around px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {BOTTOM_PRIMARY.map(item => (
        <Tab key={item.id} item={item} active={currentPage === item.id} onClick={() => onNavigate(item.id)} />
      ))}

      {canAgent && (
        <button
          onClick={() => onNavigate('chat')}
          aria-label="与 AI 对话"
          className="-mt-5 flex flex-col items-center gap-0.5"
        >
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-colors ${
            currentPage === 'chat' ? 'bg-blue-600' : 'bg-blue-500'
          } text-white`}>
            <Icon name="message" size={24} />
          </span>
        </button>
      )}

      {right.map(item => (
        <Tab key={item.id} item={item} active={currentPage === item.id} onClick={() => onNavigate(item.id)} />
      ))}

      <button
        onClick={onOpenMore}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
          moreActive ? 'text-blue-600' : 'text-slate-500'
        }`}
      >
        <Icon name="menu" size={22} />
        <span className="text-[10px] font-medium">更多</span>
      </button>
    </nav>
  )
}

function Tab({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 ${
        active ? 'text-blue-600' : 'text-slate-500'
      }`}
    >
      <Icon name={item.icon} size={22} />
      <span className="text-[10px] font-medium">{item.label}</span>
    </button>
  )
}
