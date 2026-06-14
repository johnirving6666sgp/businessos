import { useEffect, useState } from 'react'
import { useAuthStore } from './store/auth.js'
import { AppShell } from './components/layout/AppShell.jsx'
import { Login } from './pages/Login.jsx'
import { Dashboard } from './pages/Dashboard.jsx'
import { Chat } from './pages/Chat.jsx'
import { Opportunities } from './pages/Opportunities.jsx'
import { Customers } from './pages/Customers.jsx'
import { Tasks } from './pages/Tasks.jsx'
import { Proposals } from './pages/Proposals.jsx'
import { Knowledge } from './pages/Knowledge.jsx'
import { Archive } from './pages/Archive.jsx'

function Admin() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
      <div className="text-5xl mb-4">⚙️</div>
      <h2 className="text-xl font-semibold text-slate-600 mb-1">Jamie Central</h2>
      <p className="text-sm">管理面板正在开发中</p>
    </div>
  )
}

const PAGES = {
  dashboard: Dashboard,
  chat: Chat,
  opportunities: Opportunities,
  customers: Customers,
  tasks: Tasks,
  proposals: Proposals,
  knowledge: Knowledge,
  archive: Archive,
  admin: Admin,
}

export default function App() {
  const { user, loading, init } = useAuthStore()
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => { init() }, [])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">B</div>
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  const PageComponent = PAGES[currentPage] || Dashboard

  return (
    <AppShell currentPage={currentPage} onNavigate={setCurrentPage}>
      <PageComponent onNavigate={setCurrentPage} />
    </AppShell>
  )
}
