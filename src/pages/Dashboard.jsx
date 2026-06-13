import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/auth.js'
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
  const [data, setData] = useState({ urgent_tasks: [], stale_customers: [], hot_opportunities: [], pending_broadcasts: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/tasks/dashboard')
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
        <Button onClick={() => onNavigate('chat')} variant="agent" size="sm" icon="💬">
          与 AI 对话
        </Button>
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
              <Button size="sm" variant="secondary">回复</Button>
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
    </div>
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
