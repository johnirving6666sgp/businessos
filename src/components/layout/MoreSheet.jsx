import { useAuthStore } from '../../store/auth.js'
import { useUIStore } from '../../store/ui.js'
import { api } from '../../api/client.js'
import { Icon } from '../ui/Icon.jsx'
import { MORE_ITEMS } from '../../config/navConfig.js'

// 移动端“更多”底部抽屉：收纳非高频页面 + 退出。
export function MoreSheet({ open, onClose, currentPage, onNavigate }) {
  const user = useAuthStore(s => s.user)
  const can = useAuthStore(s => s.can)
  const isAdmin = useAuthStore(s => s.isAdmin)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const toast = useUIStore(s => s.toast)

  if (!open) return null

  const items = MORE_ITEMS.filter(i => {
    if (i.adminOnly) return isAdmin()
    return !i.perm || can(i.perm)
  })

  function go(id) { onNavigate(id); onClose() }

  async function handleLogout() {
    try { await api.post('/api/auth/logout') } catch { /* 忽略登出网络错误 */ }
    clearAuth()
    toast('已退出登录', 'success')
  }

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-base font-semibold text-slate-800">更多功能</h3>
          <button onClick={onClose} aria-label="关闭" className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100">
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="px-3 pb-2 grid grid-cols-2 gap-2">
          {items.map(item => {
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl text-left transition-colors ${
                  active ? 'bg-blue-50' : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-100 text-blue-600' : 'bg-white text-slate-500'}`}>
                  <Icon name={item.icon} size={20} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm leading-tight ${active ? 'text-blue-700 font-medium' : 'text-slate-700'}`}>{item.label}</span>
                  {item.hint && <span className="block text-[11px] text-slate-400 leading-tight">{item.hint}</span>}
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-3 pt-1 pb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm text-slate-500 hover:bg-slate-100"
          >
            <Icon name="logout" size={18} />退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
