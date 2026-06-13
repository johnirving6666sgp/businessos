import { useState, useEffect } from 'react'
import { api } from '../api/client.js'
import { useUIStore } from '../store/ui.js'
import { StageBadge, STAGE_META } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

const STAGES = ['untouched', 'contacted', 'interested', 'quoting', 'closing', 'won', 'lost']

export function Customers() {
  const toast = useUIStore(s => s.toast)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('kanban') // 'kanban' | 'list'
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get('/api/customers')
      setCustomers(data.customers)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleStageChange(customerId, newStage) {
    await api.patch(`/api/customers/${customerId}`, { stage: newStage })
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, stage: newStage } : c))
    toast('阶段已更新', 'success')
  }

  // 按阶段分组（排除已成交/流失）
  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = customers.filter(c => c.stage === stage)
    return acc
  }, {})

  const activeStages = STAGES.filter(s => s !== 'won' && s !== 'lost')

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">客户管理</h1>
          <p className="text-xs text-slate-400">{customers.filter(c => !['won','lost'].includes(c.stage)).length} 个进行中</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setView('kanban')} className={`text-xs px-3 py-1.5 ${view === 'kanban' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>看板</button>
            <button onClick={() => setView('list')} className={`text-xs px-3 py-1.5 ${view === 'list' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>列表</button>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ 添加</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        /* 看板视图（横向滚动） */
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 px-4 py-4 h-full min-w-max">
            {activeStages.map(stage => {
              const meta = STAGE_META[stage]
              const stageCustomers = grouped[stage] || []
              return (
                <div key={stage} className="w-64 flex-shrink-0 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <StageBadge stage={stage} />
                      <span className="text-xs text-slate-400">{stageCustomers.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {stageCustomers.map(c => (
                      <CustomerCard
                        key={c.id}
                        customer={c}
                        onClick={() => setSelected(c)}
                        onStageChange={handleStageChange}
                        stages={STAGES}
                      />
                    ))}
                    {stageCustomers.length === 0 && (
                      <div className="text-center py-6 text-slate-300 text-xs">暂无</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* 列表视图 */
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            {customers.map(c => (
              <CustomerListRow key={c.id} customer={c} onClick={() => setSelected(c)} />
            ))}
          </div>
        </div>
      )}

      {/* 客户详情侧边栏 */}
      {selected && (
        <CustomerDetail
          customer={selected}
          onClose={() => setSelected(null)}
          onUpdate={load}
        />
      )}

      {/* 添加客户弹窗 */}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onAdd={load} />}
    </div>
  )
}

function CustomerCard({ customer, onClick, onStageChange, stages }) {
  const daysSince = customer.last_interaction_at
    ? Math.floor((Date.now() - new Date(customer.last_interaction_at)) / 86400000)
    : null

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-100 rounded-xl p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
            {customer.name[0]}
          </div>
          <span className="text-sm font-medium text-slate-800 truncate">{customer.name}</span>
        </div>
        {customer.open_tasks > 0 && (
          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">{customer.open_tasks} 任务</span>
        )}
      </div>
      <div className="text-xs text-slate-400 space-y-0.5">
        {customer.owner_name && <p>负责人：{customer.owner_name}</p>}
        {daysSince !== null && (
          <p className={daysSince > 14 ? 'text-red-400' : daysSince > 7 ? 'text-amber-500' : ''}>
            {daysSince === 0 ? '今日联系' : `${daysSince} 天前联系`}
          </p>
        )}
      </div>
    </div>
  )
}

function CustomerListRow({ customer, onClick }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl px-4 py-3 cursor-pointer hover:border-blue-200 transition-all"
    >
      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-base font-semibold text-slate-600 flex-shrink-0">
        {customer.name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{customer.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{customer.owner_name} · {customer.industry || '未知行业'}</p>
      </div>
      <StageBadge stage={customer.stage} />
    </div>
  )
}

function CustomerDetail({ customer, onClose, onUpdate }) {
  const toast = useUIStore(s => s.toast)
  const [detail, setDetail] = useState(null)
  const [note, setNote] = useState('')
  const [nextAction, setNextAction] = useState('')

  useEffect(() => {
    api.get(`/api/customers/${customer.id}`)
      .then(d => setDetail(d))
      .catch(() => {})
  }, [customer.id])

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    await api.post(`/api/customers/${customer.id}/interactions`, {
      type: 'note', summary: note, next_action: nextAction || null
    })
    toast('记录已添加', 'success')
    setNote('')
    setNextAction('')
    const d = await api.get(`/api/customers/${customer.id}`)
    setDetail(d)
    onUpdate()
  }

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800">{customer.name}</h2>
            <StageBadge stage={customer.stage} />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {detail && (
            <>
              {/* 基本信息 */}
              <InfoSection title="基本信息">
                {detail.customer.contact_name && <InfoRow label="联系人" value={detail.customer.contact_name} />}
                {detail.customer.contact_phone && <InfoRow label="电话" value={detail.customer.contact_phone} />}
                {detail.customer.contact_email && <InfoRow label="邮件" value={detail.customer.contact_email} />}
                {detail.customer.industry && <InfoRow label="行业" value={detail.customer.industry} />}
                {detail.customer.notes && <InfoRow label="备注" value={detail.customer.notes} />}
              </InfoSection>

              {/* 沟通记录 */}
              {detail.interactions.length > 0 && (
                <InfoSection title="沟通记录">
                  <div className="space-y-2">
                    {detail.interactions.map(i => (
                      <div key={i.id} className="text-sm bg-slate-50 rounded-xl p-3">
                        <p className="text-slate-700">{i.summary}</p>
                        {i.next_action && <p className="text-xs text-blue-600 mt-1">下一步：{i.next_action}</p>}
                        <p className="text-xs text-slate-400 mt-1">{i.user_name} · {i.created_at?.slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                </InfoSection>
              )}

              {/* 关联任务 */}
              {detail.tasks.length > 0 && (
                <InfoSection title={`待办任务 (${detail.tasks.length})`}>
                  <div className="space-y-1.5">
                    {detail.tasks.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 truncate">{t.title}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{t.due_date || '无截止'}</span>
                      </div>
                    ))}
                  </div>
                </InfoSection>
              )}
            </>
          )}

          {/* 添加记录 */}
          <form onSubmit={addNote} className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">添加沟通记录</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="记录本次沟通内容..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-300 resize-none"
            />
            <input
              value={nextAction}
              onChange={e => setNextAction(e.target.value)}
              placeholder="下一步行动（选填）"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-300"
            />
            <Button type="submit" size="sm" disabled={!note.trim()}>保存记录</Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function InfoSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-2 text-sm py-1">
      <span className="text-slate-400 w-16 flex-shrink-0">{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  )
}

function AddCustomerModal({ onClose, onAdd }) {
  const toast = useUIStore(s => s.toast)
  const [form, setForm] = useState({ name: '', stage: 'untouched', industry: '', contact_name: '', contact_phone: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await api.post('/api/customers', form)
      toast('客户已添加', 'success')
      onAdd()
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 space-y-4">
        <h2 className="font-bold text-slate-800">添加客户</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="客户名称 *">
            <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="公司或个人名称" className={INPUT_CLASS} required />
          </Field>
          <Field label="初始阶段">
            <select value={form.stage} onChange={e => update('stage', e.target.value)} className={INPUT_CLASS}>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_META[s]?.label || s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="行业">
              <input value={form.industry} onChange={e => update('industry', e.target.value)} placeholder="例如：半导体" className={INPUT_CLASS} />
            </Field>
            <Field label="联系人">
              <input value={form.contact_name} onChange={e => update('contact_name', e.target.value)} placeholder="姓名" className={INPUT_CLASS} />
            </Field>
          </div>
          <Field label="联系电话">
            <input value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} placeholder="手机或座机" className={INPUT_CLASS} />
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">取消</Button>
            <Button type="submit" loading={loading} className="flex-1">添加</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLASS = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-300 bg-white'
