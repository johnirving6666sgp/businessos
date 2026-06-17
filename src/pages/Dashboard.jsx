import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/auth.js'
import { useUIStore } from '../store/ui.js'
import { api } from '../api/client.js'
import { StageBadge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

const STAGE_LABELS = {
  untouched: '未接触', contacted: '已接触', interested: '有意向',
  quoting: '待报价', closing: '待成交', won: '已成交', lost: '已流失',
}

export function Dashboard({ onNavigate }) {
  const user = useAuthStore(s => s.user)
  const agent = useAuthStore(s => s.agent)
  const isAdmin = useAuthStore(s => s.isAdmin)
  const can = useAuthStore(s => s.can)
  const toast = useUIStore(s => s.toast)
  const [data, setData] = useState({ urgent_tasks: [], stale_customers: [], hot_opportunities: [], pending_broadcasts: [] })
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [respondTo, setRespondTo] = useState(null)

  const canBroadcast = isAdmin() || can('broadcast')

  function loadDashboard() {
    return api.get('/api/tasks/dashboard')
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDashboard() }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const totalItems = data.urgent_tasks.length + data.stale_customers.length + data.hot_opportunities.length + data.pending_broadcasts.length

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* 问候 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {greeting}，{user?.display_name}。
          </h1>
          {!loading && (
            <p className="text-sm text-slate-500 mt-0.5">
              {totalItems > 0 ? `今天有 ${totalItems} 件事值得关注` : '今天一切正常 🎉'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canBroadcast && (
            <Button onClick={() => setShowCompose(true)} variant="secondary" size="sm" icon="📢">
              发广播
            </Button>
          )}
          <Button onClick={() => onNavigate('chat')} variant="agent" size="sm" icon="💬">
            与 AI 对话
          </Button>
        </div>
      </div>

      {loading && <LoadingSkeleton />}

      {!loading && totalItems === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-slate-600 font-medium">今日清空！</p>
          <p className="text-sm text-slate-400 mt-1">没有紧急任务、也没有待跟进的事项</p>
        </div>
      )}

      {/* 热门商机 */}
      {data.hot_opportunities.length > 0 && (
        <Section icon="🔥" title="热门商机" onMore={() => onNavigate('opportunities')}>
          {data.hot_opportunities.map(o => (
            <div key={o.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{o.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {o.org_name && `${o.org_name} · `}
                  {o.budget && `${o.budget} · `}
                  最高评分 <span className="text-amber-600 font-semibold">{o.max_rating}</span> 分
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onNavigate('opportunities')}>查看</Button>
            </div>
          ))}
        </Section>
      )}

      {/* 紧急任务 */}
      {data.urgent_tasks.length > 0 && (
        <Section icon="⏰" title="今日截止任务" onMore={() => onNavigate('tasks')}>
          {data.urgent_tasks.map(t => (
            <div key={t.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t.customer_name && `${t.customer_name} · `}
                  截止 {t.due_date}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                t.due_date === new Date().toISOString().slice(0, 10)
                  ? 'bg-red-50 text-red-600'
                  : 'bg-amber-50 text-amber-600'
              }`}>
                {t.due_date === new Date().toISOString().slice(0, 10) ? '今天' : '明天'}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* 久未跟进的客户 */}
      {data.stale_customers.length > 0 && (
        <Section icon="💤" title="久未跟进" badge="需要关注" onMore={() => onNavigate('customers')}>
          {data.stale_customers.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
                  {c.name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StageBadge stage={c.stage} />
                    <span className="text-xs text-slate-400">{c.days_since} 天未联系</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onNavigate('customers')}>跟进</Button>
            </div>
          ))}
        </Section>
      )}

      {/* 等待回复的广播 */}
      {data.pending_broadcasts.length > 0 && (
        <Section icon="📢" title="等你回复">
          {data.pending_broadcasts.map(b => (
            <div key={b.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{b.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{b.creator_name} 发布</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setRespondTo(b)}>回复</Button>
            </div>
          ))}
        </Section>
      )}

      {/* Agent 状态 */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-400 to-blue-500 rounded-xl flex items-center justify-center text-white text-sm font-bold">AI</div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{user?.display_name}_AI</p>
              <p className="text-xs text-slate-500">
                {agent ? GROWTH_LEVEL_LABELS[agent.growth_level] || '初级' : '初级'}
                {agent ? ` · ${agent.growth_points} 积分` : ''}
              </p>
            </div>
          </div>
          <Button onClick={() => onNavigate('chat')} size="sm" variant="agent">开始对话</Button>
        </div>
      </div>

      {/* 发广播 */}
      {showCompose && (
        <BroadcastComposer
          toast={toast}
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); loadDashboard() }}
        />
      )}

      {/* 回复广播 */}
      {respondTo && (
        <BroadcastRespond
          broadcast={respondTo}
          toast={toast}
          onClose={() => setRespondTo(null)}
          onDone={() => { setRespondTo(null); loadDashboard() }}
        />
      )}
    </div>
  )
}

const INPUT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 transition-colors'

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-slate-100 z-10">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function BroadcastComposer({ toast, onClose, onSent }) {
  const [recipients, setRecipients] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get('/api/broadcasts/recipients')
      .then(d => setRecipients(d.recipients || []))
      .catch(e => toast(e.message || '加载成员失败', 'error'))
      .finally(() => setLoading(false))
  }, [])

  function toggle(id) {
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const allSelected = recipients.length > 0 && selected.size === recipients.length
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(recipients.map(r => r.id)))
  }

  async function submit() {
    if (!title.trim() || !content.trim()) return toast('标题和内容必填', 'error')
    if (selected.size === 0) return toast('请至少选择一个接收人', 'error')
    setSending(true)
    try {
      await api.post('/api/broadcasts', {
        title: title.trim(),
        content: content.trim(),
        target_user_ids: [...selected],
      })
      toast('广播已发送', 'success')
      onSent()
    } catch (e) {
      toast(e.message || '发送失败', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell title="发广播" onClose={onClose}>
      <div className="p-4 space-y-3">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="广播标题"
          maxLength={80}
          className={INPUT_CLS}
        />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="广播内容…"
          rows={4}
          className={`${INPUT_CLS} resize-none`}
        />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">接收人（{selected.size}/{recipients.length}）</span>
            {recipients.length > 0 && (
              <button onClick={toggleAll} className="text-xs text-blue-500 hover:text-blue-700">
                {allSelected ? '清空' : '全选'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">暂无其他可接收的成员</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recipients.map(r => {
                const on = selected.has(r.id)
                return (
                  <button
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      on
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {on ? '✓ ' : ''}{r.display_name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
        <Button size="sm" loading={sending} onClick={submit} icon="📢">发送</Button>
      </div>
    </ModalShell>
  )
}

const RESPOND_STATUSES = [
  { id: 'received', label: '收到' },
  { id: 'following_up', label: '跟进中' },
  { id: 'need_discussion', label: '需讨论' },
]

function BroadcastRespond({ broadcast, toast, onClose, onDone }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function respond(status) {
    setBusy(true)
    try {
      await api.post(`/api/broadcasts/${broadcast.id}/respond`, { status, note: note.trim() || null })
      toast('已回复', 'success')
      onDone()
    } catch (e) {
      toast(e.message || '回复失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell title="回复广播" onClose={onClose}>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{broadcast.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{broadcast.creator_name} 发布</p>
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="补充说明（可选）"
          rows={3}
          className={`${INPUT_CLS} resize-none`}
        />
        <div className="grid grid-cols-3 gap-2">
          {RESPOND_STATUSES.map(s => (
            <Button key={s.id} variant="secondary" size="sm" disabled={busy} onClick={() => respond(s.id)}>
              {s.label}
            </Button>
          ))}
        </div>
      </div>
    </ModalShell>
  )
}

function Section({ icon, title, badge, onMore, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          {badge && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        {onMore && (
          <button onClick={onMore} className="text-xs text-blue-500 hover:text-blue-700">全部 →</button>
        )}
      </div>
      <div className="px-4 py-3 space-y-3 divide-y divide-slate-50">
        {children}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-32" />
          <div className="h-3 bg-slate-50 rounded-lg animate-pulse w-full" />
          <div className="h-3 bg-slate-50 rounded-lg animate-pulse w-3/4" />
        </div>
      ))}
    </div>
  )
}

const GROWTH_LEVEL_LABELS = {
  0: '初级', 1: '⭐ 半星', 2: '⭐ 一星', 3: '⭐ 一星半',
  4: '⭐⭐ 二星', 5: '⭐⭐ 二星半', 6: '⭐⭐⭐ 三星',
  7: '⭐⭐⭐ 三星半', 8: '⭐⭐⭐⭐ 四星', 9: '⭐⭐⭐⭐⭐ 五星',
}
