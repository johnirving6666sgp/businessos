import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { BottomNav } from './BottomNav.jsx'
import { MoreSheet } from './MoreSheet.jsx'
import { ToastContainer } from '../ui/Toast.jsx'
import { MORE_ITEMS } from '../../config/navConfig.js'

const MORE_IDS = MORE_ITEMS.map(i => i.id)

export function AppShell({ children, currentPage, onNavigate }) {
  const [moreOpen, setMoreOpen] = useState(false)

  // 切换页面时收起“更多”抽屉
  useEffect(() => { setMoreOpen(false) }, [currentPage])

  return (
    <div className="flex h-dvh bg-slate-50 overflow-hidden">
      {/* 桌面侧边栏 */}
      <div className="hidden md:flex w-64 flex-shrink-0">
        <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      </div>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          {children}
        </div>

        {/* 移动端底部导航 */}
        <div className="md:hidden flex-shrink-0 border-t border-slate-200 bg-white">
          <BottomNav
            currentPage={currentPage}
            onNavigate={onNavigate}
            onOpenMore={() => setMoreOpen(true)}
            moreActive={MORE_IDS.includes(currentPage)}
          />
        </div>
      </main>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        currentPage={currentPage}
        onNavigate={onNavigate}
      />

      <ToastContainer />
    </div>
  )
}
