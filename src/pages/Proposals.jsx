import { useState, useEffect } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { useUIStore } from '../store/ui.js'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'

const STATUS_LABELS = {
  draft: '草稿',
  review: '审核中',
  sent: '已发送',
  won: '已中标',
  lost: '未中标',
}

const STATUS_COLORS = {
  draft: 'default',
  review: 'amber',
  sent: 'blue',
  won: 'green',
  lost: 'red',
}

export function Proposals({ onNavigate }) {
  const user = useAuthStore(s => s.user)
  const toast = useUIStore(s => s.toast)

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)  // 选中方案详情
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  async function load(p = 1, status = statusFilter) {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: p, limit: 20 })
      if (status) qs.set('status', status)
      const data = await api.get(`/api/proposals?${qs}`)
      setItems(data.proposals)
      setTotal(data.total)
      setPage(p)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  async function handleCreate(form) {
    try {
      const data = await api.post('/api/proposals', form)
      toast('方案已创建', 'success')
      setShowCreate(false)
      load(1)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await api.patch(`/api/proposals/${id}`, { status })
      setItems(prev => prev.map(p => p.id === id ? { ...p, status } : p))
      if (selected?.id === id) setSelected(s => ({ ...s, status }))
      toast('状态已更新', 'success')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="flex h-full">
      {/* 左侧列表 */}
      <div className={`flex flex-col ${selected ? 'w-80 flex-shrink-0 border-r border-slate-100' : 'flex-1'}`}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-800">方案工程师</h1>
            <p className="text-xs text-slate-400">{total} 份方案</p>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>+ 新建方案</Button>
        </div>

        {/* 过滤栏 */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0 overflow-x-auto">
          {['', 'draft', 'review', 'sent', 'won', 'lost'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); load(1, s) }}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {s ? STATUS_LABELS[s] : '全部'}
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 p-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p>暂无方案</p>
              <p className="text-sm mt-1">点击"新建方案"开始</p>
            </div>
          )}

          <div className="p-3 space-y-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selected?.id === item.id
                    ? 'border-blue-200 bg-blue-50 shadow-sm'
                    : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800 leading-snug flex-1 min-w-0 truncate">
                    {item.title}
                  </span>
                  <Badge variant={STATUS_COLORS[item.status] || 'default'}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </div>
                {item.customer_name && (
                  <p className="text-xs text-slate-500 truncate">📌 {item.customer_name}</p>
                )}
                {(item.price_range_min || item.price_range_max) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    💰 {item.price_range_min ? `${(item.price_range_min/10000).toFixed(0)}万` : ''}
                    {item.price_range_min && item.price_range_max ? ' ~ ' : ''}
                    {item.price_range_max ? `${(item.price_range_max/10000).toFixed(0)}万` : ''}
                  </p>
                )}
                <p className="text-xs text-slate-300 mt-1">
                  {item.creator_name} · {new Date(item.updated_at).toLocaleDateString('zh-CN')}
                </p>
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => load(page - 1)}>上一页</Button>
              <span className="text-xs text-slate-400">{page}/{totalPages}</span>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => load(page + 1)}>下一页</Button>
            </div>
          )}
        </div>
      </div>

      {/* 右侧详情面板 */}
      {selected && (
        <div className="flex-1 overflow-y-auto">
          <ProposalDetail
            proposal={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
            onNavigate={onNavigate}
            toast={toast}
          />
        </div>
      )}

      {/* 新建方案弹窗 */}
      {showCreate && (
        <CreateProposalModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </div>
  )
}

// ── 方案详情 ────────────────────────────────────────────────────

function ProposalDetail({ proposal, onClose, onStatusChange, onNavigate, toast }) {
  const STATUSES = ['draft', 'review', 'sent', 'won', 'lost']

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0 bg-white">
        <h2 className="text-base font-bold text-slate-800 truncate flex-1 mr-4">{proposal.title}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="agent"
            icon="💬"
            onClick={() => {
              onNavigate?.('chat')
              toast(`已跳转到AI对话，可询问关于「${proposal.title.slice(0,15)}」的建议`, 'success')
            }}
          >
            AI 建议
          </Button>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* 基本信息 */}
        <Section title="基本信息">
          <Grid>
            <InfoRow label="客户" value={proposal.customer_name || '—'} />
            <InfoRow label="创建人" value={proposal.creator_name || '—'} />
            <InfoRow label="更新时间" value={new Date(proposal.updated_at).toLocaleDateString('zh-CN')} />
            <InfoRow
              label="报价区间"
              value={
                proposal.price_range_min || proposal.price_range_max
                  ? `${proposal.price_range_min ? (proposal.price_range_min/10000).toFixed(1)+'万' : ''} ~ ${proposal.price_range_max ? (proposal.price_range_max/10000).toFixed(1)+'万' : ''}`
                  : '—'
              }
            />
          </Grid>
        </Section>

        {/* 状态流转 */}
        <Section title="状态">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => onStatusChange(proposal.id, s)}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium border transition-all ${
                  proposal.status === s
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </Section>

        {/* 项目范围 */}
        {proposal.scope && (
          <Section title="项目范围">
            <Prose>{proposal.scope}</Prose>
          </Section>
        )}

        {/* 技术参数 */}
        {proposal.tech_params && (
          <Section title="技术参数">
            {Array.isArray(proposal.tech_params)
              ? <ul className="space-y-1">{proposal.tech_params.map((t, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-slate-400">·</span>{t}</li>)}</ul>
              : typeof proposal.tech_params === 'object'
                ? <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">{Object.entries(proposal.tech_params).map(([k,v]) => (<><dt key={k+'k'} className="text-xs text-slate-500">{k}</dt><dd key={k+'v'} className="text-sm text-slate-800">{v}</dd></>))}</dl>
                : <Prose>{String(proposal.tech_params)}</Prose>
            }
          </Section>
        )}

        {/* 费用分解 */}
        {proposal.cost_breakdown && (
          <Section title="费用分解">
            {typeof proposal.cost_breakdown === 'object' && !Array.isArray(proposal.cost_breakdown)
              ? <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {Object.entries(proposal.cost_breakdown).map(([k,v]) => (
                    <><dt key={k+'k'} className="text-xs text-slate-500">{k}</dt><dd key={k+'v'} className="text-sm font-medium text-slate-800">{typeof v === 'number' ? `¥${v.toLocaleString()}` : v}</dd></>
                  ))}
                </dl>
              : <Prose>{JSON.stringify(proposal.cost_breakdown, null, 2)}</Prose>
            }
          </Section>
        )}

        {/* 风险点 */}
        {proposal.risk_points && (
          <Section title="风险点">
            <Prose>{proposal.risk_points}</Prose>
          </Section>
        )}

        {/* 谈判空间 */}
        {proposal.negotiation_space && (
          <Section title="谈判空间">
            <Prose>{proposal.negotiation_space}</Prose>
          </Section>
        )}

        {/* 待确认问题 */}
        {proposal.open_questions && (
          <Section title="待确认问题">
            <Prose>{proposal.open_questions}</Prose>
          </Section>
        )}

        {/* 参考案例 */}
        {proposal.reference_cases && proposal.reference_cases.length > 0 && (
          <Section title="参考案例">
            <ul className="space-y-1">
              {(Array.isArray(proposal.reference_cases) ? proposal.reference_cases : [proposal.reference_cases]).map((c, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-slate-400">📁</span>{c}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </div>
  )
}

// ── 新建方案弹窗 ─────────────────────────────────────────────────

function CreateProposalModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '',
    status: 'draft',
    price_range_min: '',
    price_range_max: '',
    scope: '',
    risk_points: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onCreate({
        ...form,
        price_range_min: form.price_range_min ? parseFloat(form.price_range_min) * 10000 : null,
        price_range_max: form.price_range_max ? parseFloat(form.price_range_max) * 10000 : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">新建方案</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="方案标题 *">
            <input
              autoFocus
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="如：真空感应熔炼炉 VIM-50 完整方案"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="报价下限（万元）">
              <input
                type="number"
                value={form.price_range_min}
                onChange={e => set('price_range_min', e.target.value)}
                placeholder="如 80"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </Field>
            <Field label="报价上限（万元）">
              <input
                type="number"
                value={form.price_range_max}
                onChange={e => set('price_range_max', e.target.value)}
                placeholder="如 120"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </Field>
          </div>
          <Field label="项目范围">
            <textarea
              value={form.scope}
              onChange={e => set('scope', e.target.value)}
              rows={3}
              placeholder="描述方案涵盖的设备型号、技术规格、交付物..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose}>取消</Button>
            <Button type="submit" loading={saving} disabled={!form.title.trim()}>创建</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── 小组件 ───────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</dl>
}

function InfoRow({ label, value }) {
  return (
    <>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </>
  )
}

function Prose({ children }) {
  return (
    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
      {children}
    </p>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
