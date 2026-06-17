import { useAuthStore } from '../../store/auth.js'
import { useUIStore } from '../../store/ui.js'
import { api } from '../../api/client.js'
import { Icon } from '../ui/Icon.jsx'
import { NAV_GROUPS, ADMIN_GROUP } from '../../config/navConfig.js'

export function Sidebar({ currentPage, onNavigate }) {
  const user = useAuthStore(s => s.user)
  const can = useAuthStore(s => s.can)
  const isAdmin = useAuthStore(s => s.isAdmin)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const toast = useUIStore(s => s.toast)

  const groups = NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => !i.perm || can(i.perm)) }))
    .filter(g => g.items.length > 0)

  async function handleLogout() {
    try { await api.post('/api/auth/logout') } catch { /* 忽略登出网络错误 */ }
    clearAuth()
    toast('已退出登录', 'success')
  }

  return (
    <div className="flex flex-col h-full w-full bg-white border-r border-slate-200">
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center text-white font-semibold">B</div>
        <span className="font-semibold text-slate-800">BusinessOS</span>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-blue-50">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {user?.display_name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-800 truncate">{user?.display_name}</div>
            <div className="text-xs text-blue-600 truncate">{user?.role === 'super_admin' ? '系统管理员' : '团队成员'}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
        {groups.map(group => (
          <div key={group.label}>
            <div className="px-2 mb-1 text-[11px] font-medium text-slate-400">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.id} item={item} active={currentPage === item.id} onClick={() => onNavigate(item.id)} />
              ))}
            </div>
          </div>
        ))}

        {isAdmin() && (
          <div>
            <div className="px-2 mb-1 text-[11px] font-medium text-slate-400">{ADMIN_GROUP.label}</div>
            <div className="space-y-0.5">
              {ADMIN_GROUP.items.map(item => (
                <NavItem key={item.id} item={item} active={currentPage === item.id} onClick={() => onNavigate(item.id)} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="px-3 py-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <Icon name="logout" size={18} />
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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon name={item.icon} size={20} className={active ? 'text-blue-600' : 'text-slate-500'} />
      <span className="min-w-0">
        <span className={`block text-sm leading-tight ${active ? 'font-medium' : ''}`}>{item.label}</span>
        {item.hint && <span className="block text-[11px] text-slate-400 leading-tight">{item.hint}</span>}
      </span>
    </button>
  )
}
