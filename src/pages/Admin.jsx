import { useState, useEffect } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { useUIStore } from '../store/ui.js'
import { Badge } from '../components/ui/Badge.jsx'

const MODELS = [
  { id: 'opus', label: 'Opus', hint: '最强' },
  { id: 'sonnet', label: 'Sonnet', hint: '均衡' },
  { id: 'haiku', label: 'Haiku', hint: '快省' },
]

const PERMISSIONS = [
  { key: 'agents', label: '个人 Agent' },
  { key: 'customers', label: '客户管理' },
  { key: 'tasks', label: '任务' },
  { key: 'quote', label: '方案工程师' },
  { key: 'quoteTraining', label: '方案训练' },
  { key: 'insight', label: '信息仓' },
]

const ROLE_META = {
  super_admin: { label: '管理员', variant: 'violet' },
  admin: { label: '管理', variant: 'blue' },
  member: { label: '成员', variant: 'gray' },
}

export function Admin() {
  const me = useAuthStore(s => s.user)
  const toast = useUIStore(s => s.toast)

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})   // { [userId]: true } 请求进行中

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/auth/users')
      setUsers(data.users || [])
    } catch (e) {
      toast(e.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // 乐观更新：先改本地，请求失败再回滚
  async function patch(userId, apply, req, okMsg) {
    const prev = users
    setUsers(list => list.map(u => (u.id === userId ? apply(u) : u)))
    setBusy(b => ({ ...b, [userId]: true }))
    try {
      await req()
      if (okMsg) toast(okMsg, 'success')
    } catch (e) {
      setUsers(prev) // 回滚
      toast(e.message || '操作失败', 'error')
    } finally {
      setBusy(b => ({ ...b, [userId]: false }))
    }
  }

  function togglePerm(user, key) {
    const next = !user.permissions?.[key]
    patch(
      user.id,
      u => ({ ...u, permissions: { ...u.permissions, [key]: next } }),
      () => api.patch(`/api/auth/users/${user.id}/permissions`, { [key]: next }),
      `${user.display_name} · ${PERMISSIONS.find(p => p.key === key)?.label} 已${next ? '开通' : '关闭'}`,
    )
  }

  function setModel(user, tier) {
    if (user.model_tier === tier) return
    patch(
      user.id,
      u => ({ ...u, model_tier: tier }),
      () => api.patch(`/api/auth/users/${user.id}/model`, { model_tier: tier }),
      `${user.display_name} 模型已切换为 ${tier}`,
    )
  }

  function toggleActive(user) {
    const next = !user.is_active
    patch(
      user.id,
      u => ({ ...u, is_active: next ? 1 : 0 }),
      () => api.patch(`/api/auth/users/${user.id}/active`, { is_active: next }),
      `${user.display_name} 账号已${next ? '启用' : '停用'}`,
    )
  }

  // ── 概览统计 ──────────────────────────────────────────────
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    training: users.filter(u => u.permissions?.quoteTraining).length,
    models: MODELS.map(m => ({ ...m, n: users.filter(u => u.model_tier === m.id).length })),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-4 md:px-6 md:py-6">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚙️</span>
          <h1 className="text-lg font-bold text-slate-800">Jamie Central</h1>
        </div>
        <p className="text-xs text-slate-400 mb-5">用户与权限管理 · 仅管理员可见</p>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="团队成员" value={stats.total} />
          <StatCard label="启用中" value={stats.active} accent="green" />
          <StatCard label="方案训练授权" value={stats.training} accent="violet" />
          <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm">
            <div className="text-xs text-slate-400 mb-1.5">模型分布</div>
            <div className="flex flex-wrap gap-1">
              {stats.models.map(m => (
                <span key={m.id} className="text-xs text-slate-600">
                  {m.label} <span className="font-semibold text-slate-800">{m.n}</span>
                </span>
              )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`s${i}`} className="text-slate-300">·</span>, el], [])}
            </div>
          </div>
        </div>

        {/* 用户列表 */}
        <h2 className="text-sm font-semibold text-slate-700 mb-3">团队成员</h2>
        <div className="space-y-3">
          {users.map(user => (
            <UserCard
              key={user.id}
              user={user}
              isSelf={user.id === me?.id}
              busy={!!busy[user.id]}
              onTogglePerm={togglePerm}
              onSetModel={setModel}
              onToggleActive={toggleActive}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent }) {
  const color = accent === 'green' ? 'text-green-600' : accent === 'violet' ? 'text-violet-600' : 'text-slate-800'
  return (
    <div className="bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function UserCard({ user, isSelf, busy, onTogglePerm, onSetModel, onToggleActive }) {
  const role = ROLE_META[user.role] || ROLE_META.member
  const inactive = !user.is_active

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 transition-opacity ${inactive ? 'border-slate-100 opacity-60' : 'border-slate-100'}`}>
      {/* 顶部：身份 + 启停 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {user.display_name?.[0] || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 truncate">{user.display_name}</span>
            <Badge variant={role.variant}>{role.label}</Badge>
            {inactive && <Badge variant="red">已停用</Badge>}
          </div>
          <div className="text-xs text-slate-400 truncate">@{user.username}</div>
        </div>
        <button
          onClick={() => onToggleActive(user)}
          disabled={busy || isSelf}
          title={isSelf ? '不能停用自己的账号' : ''}
          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            inactive
              ? 'border-green-200 text-green-700 hover:bg-green-50'
              : 'border-red-200 text-red-600 hover:bg-red-50'
          }`}
        >
          {inactive ? '启用' : '停用'}
        </button>
      </div>

      {/* 模型档位 */}
      <div className="mt-3.5 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 w-12 flex-shrink-0">模型</span>
        <div className="flex gap-1">
          {MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => onSetModel(user, m.id)}
              disabled={busy}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                user.model_tier === m.id
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 权限 */}
      <div className="mt-2.5 flex items-start gap-2 flex-wrap">
        <span className="text-xs text-slate-400 w-12 flex-shrink-0 pt-1">权限</span>
        <div className="flex gap-1.5 flex-wrap flex-1">
          {PERMISSIONS.map(p => {
            const on = !!user.permissions?.[p.key]
            return (
              <button
                key={p.key}
                onClick={() => onTogglePerm(user, p.key)}
                disabled={busy}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                  on
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                }`}
              >
                {on ? '✓ ' : ''}{p.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
