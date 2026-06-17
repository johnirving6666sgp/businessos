import { useState } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { Icon } from '../components/ui/Icon.jsx'

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
      setAuth({ user: data.user, permissions: data.user.permissions || {}, agent: null })
    } catch (err) {
      setError(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-colors text-[15px]'

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-blue-500 rounded-3xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">B</div>
          <h1 className="text-2xl font-bold text-slate-800">BusinessOS</h1>
          <p className="text-slate-500 text-sm mt-1.5">你好呀，欢迎回来</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="例如：jamie"
              autoComplete="username"
              autoFocus
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className={inputCls}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-2.5 text-red-600 text-sm">
              <Icon name="x" size={16} />{error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-2xl py-3 text-[15px] transition-colors"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Icon name="arrow-right" size={18} />}
            {loading ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-6">BusinessOS v2.0 · 企业智能工作台</p>
      </div>
    </div>
  )
}
