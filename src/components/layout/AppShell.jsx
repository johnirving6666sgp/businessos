import { useEffect } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { BottomNav } from './BottomNav.jsx'
import { ToastContainer } from '../ui/Toast.jsx'
import { useUIStore } from '../../store/ui.js'
import { useAuthStore } from '../../store/auth.js'

export function AppShell({ children, currentPage, onNavigate }) {
  const sidebarOpen = useUIStore(s => s.sidebarOpen)
  const closeSidebar = useUIStore(s => s.closeSidebar)

  // 关闭侧边栏当 page 切换
  useEffect(() => { closeSidebar() }, [currentPage])

  return (
    <div className="flex h-dvh bg-slate-50 overflow-hidden">
      {/* 桌面侧边栏 */}
      <div className="hidden md:flex w-60 flex-shrink-0">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      </div>

      {/* 移动端侧边栏（drawer） */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 flex-shrink-0 bg-white shadow-xl">
            <Sidebar currentPage={currentPage} onNavigate={onNavigate} mobile />
          </div>
          <div className="flex-1 bg-black/40" onClick={closeSidebar} />
        </div>
      )}

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </div>

        {/* 移动端底部导航 */}
        <div className="md:hidden flex-shrink-0 border-t border-slate-200 bg-white">
          <BottomNav currentPage={currentPage} onNavigate={onNavigate} />
        </div>
      </main>

      {/* 全局 Toast */}
      <ToastContainer />
    </div>
  )
}
