import { useAuthStore } from '../../store/auth.js'
import { useUIStore } from '../../store/ui.js'
import { api } from '../../api/client.js'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '⬛', label: '工作台' },
  { id: 'chat', icon: '💬', label: '我的 Agent', perm: 'agents' },
  { id: 'opportunities', icon: '🔍', label: '线索池' },
  { id: 'customers', icon: '👥', label: '客户', perm: 'customers' },
  { id: 'tasks', icon: '✅', label: '任务', perm: 'tasks' },
  { id: 'proposals', icon: '📋', label: '方案工程师', perm: 'quote' },
  { id: 'knowledge', icon: '📚', label: '知识库', perm: 'insight' },
  { id: 'archive',   icon: '🗂️', label: '个人档案' },
]

const ADMIN_ITEMS = [
  { id: 'admin', icon: '⚙️', label: 'Jamie Central' },
]

export function Sidebar({ currentPage, onNavigate, mobile = false }) {
  const user = useAuthStore(s => s.user)
  const can = useAuthStore(s => s.can)
  const isAdmin = useAuthStore(s => s.isAdmin)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const toast = useUIStore(s => s.toast)

  const navItems = NAV_ITEMS.filter(item => !item.perm || can(item.perm))
  const adminItems = isAdmin() ? ADMIN_ITEMS : []

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout')
    } catch {}
    clearAuth()
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-full">
      {/* 头部 Logo */}
      <div className="px-4 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">B</div>
          <span className="text-white font-semibold text-sm">BusinessOS</span>
          <span className="text-xs text-slate-500 ml-auto">v2</span>
        </div>
      </div>

      {/* 用户信息 */}
      <div className="px-3 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.display_name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.display_name}</div>
            <div className="text-xs text-slate-400 truncate">{user?.role === 'super_admin' ? '系统管理员' : '团队成员'}</div>
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navItems.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={currentPage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}

        {adminItems.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-700/50" />
            {adminItems.map(item => (
              <NavItem
                key={item.id}
                item={item}
                active={currentPage === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </>
        )}
      </nav>

      {/* 退出 */}
      <div className="px-2 py-3 border-t border-slate-700/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          <span>↩</span>
          <span>退出登录</span>
        </button>
      </div>
    </div>
  )
}

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-blue-600 text-white font-medium'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
      }`}
    >
      <span className="text-base w-5 text-center">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  )
}
