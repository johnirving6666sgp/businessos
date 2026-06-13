import { useState } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { Button } from '../components/ui/Button.jsx'

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore(s => s.setAuth)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/api/auth/login', { username, password })
      setAuth({ user: data.user, permissions: data.user.permissions || {}, token: data.token, agent: null })
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-lg">B</div>
          <h1 className="text-2xl font-bold text-white">BusinessOS</h1>
          <p className="text-slate-400 text-sm mt-1">企业智能工作台</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="例如：jamie"
              autoComplete="username"
              autoFocus
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-blue-400 transition-colors text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-blue-400 transition-colors text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-4 py-2.5 text-red-300 text-sm">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg">
            登录
          </Button>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          BusinessOS v2.0 · 内部系统
        </p>
      </div>
    </div>
  )
}
