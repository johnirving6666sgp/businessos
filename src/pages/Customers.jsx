import { useState, useEffect } from 'react'
import { api } from '../api/client.js'
import { useUIStore } from '../store/ui.js'
import { useConversationsStore } from '../store/conversations.js'
import { createConversation } from '../api/conversations.js'
import { StageBadge, STAGE_META } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'

const STAGES = ['untouched', 'contacted', 'interested', 'quoting', 'closing', 'won', 'lost']

export function Customers({ onNavigate }) {
  const toast = useUIStore(s => s.toast)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState('kanban')
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

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = customers.filter(c => c.stage === stage)
    return acc
  }, {})

  const activeStages = STAGES.filter(s => s !== 'won' && s !== 'lost')
  const activeCount = customers.filter(c => !['won', 'lost'].includes(c.stage)).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Icon name="users" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">客户</h1>
            <p className="text-xs text-slate-400">{activeCount} 个在跟进</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-slate-200 overflow-hidden">
            <button onClick={() => setView('kanban')} className={`text-xs px-3 py-1.5 ${view === 'kanban' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>看板</button>
            <button onClick={() => setView('list')} className={`text-xs px-3 py-1.5 ${view === 'list' ? 'bg-blue-500 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>列表</button>
          </div>
          <Button size="sm" pill onClick={() => setShowAdd(true)} icon={<Icon name="plus" size={15} />}>添加</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
            <Icon name="users-plus" size={28} />
          </div>
          <p className="text-sm font-medium text-slate-700">还没有客户</p>
          <p className="text-xs text-slate-400 mt-1 mb-3">从线索池挑一个，或手动添加第一个客户</p>
          <Button size="sm" pill onClick={() => setShowAdd(true)} icon={<Icon name="plus" size={15} />}>添加客户</Button>
        </div>
      ) : view === 'kanban' ? (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 px-4 py-4 h-full min-w-max">
            {activeStages.map(stage => {
              const stageCustomers = grouped[stage] || []
              return (
                <div key={stage} className="w-64 flex-shrink-0 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <StageBadge stage={stage} />
                    <span className="text-xs text-slate-400">{stageCustomers.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {stageCustomers.map(c => (
                      <CustomerCard key={c.id} customer={c} onClick={() => setSelected(c)} onStageChange={handleStageChange} stages={STAGES} />
                    ))}
                    {stageCustomers.length === 0 && <div className="text-center py-6 text-slate-300 text-xs">暂无</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            {customers.map(c => (
              <CustomerListRow key={c.id} customer={c} onClick={() => setSelected(c)} />
            ))}
          </div>
        </div>
      )}

      {selected && (
        <CustomerDetail customer={selected} onClose={() => setSelected(null)} onUpdate={load} onNavigate={onNavigate} />
      )}
      {showAdd && <AddCustomerModal onClose={() => setShowAdd(false)} onAdd={load} />}
    </div>
  )
}

function CustomerCard({ customer, onClick }) {
  const daysSince = customer.last_interaction_at
    ? Math.floor((Date.now() - new Date(customer.last_interaction_at)) / 86400000)
    : null

  return (
    <div onClick={onClick} className="bg-white border border-slate-100 rounded-2xl p-3 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
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
    <div onClick={onClick} className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 cursor-pointer hover:border-blue-200 transition-all">
      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-base font-semibold text-slate-600 flex-shrink-0">
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

function CustomerDetail({ customer, onClose, onUpdate, onNavigate }) {
  const toast = useUIStore(s => s.toast)
  const setPendingEntityRef = useConversationsStore(s => s.setPendingEntityRef)
  const [detail, setDetail] = useState(null)
  const [note, setNote] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [pulling, setPulling] = useState(false)

  async function handlePullToChat() {
    setPulling(true)
    try {
      await createConversation('customer')
      setPendingEntityRef({ type: 'customer', id: customer.id, name: customer.name })
      onClose()
      onNavigate?.('chat')
      toast(`已拉入对话：${customer.name}`, 'success')
    } catch (e) {
      toast('拉入失败：' + e.message, 'error')
    } finally {
      setPulling(false)
    }
  }

  useEffect(() => {
    api.get(`/api/customers/${customer.id}`).then(d => setDetail(d)).catch(() => {})
  }, [customer.id])

  async function addNote(e) {
    e.preventDefault()
    if (!note.trim()) return
    await api.post(`/api/customers/${customer.id}/interactions`, { type: 'note', summary: note, next_action: nextAction || null })
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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" pill icon={<Icon name="message" size={15} />} onClick={handlePullToChat} disabled={pulling}>
              {pulling ? '…' : '拉进对话'}
            </Button>
            <button onClick={onClose} aria-label="关闭" className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Icon name="x" size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {detail && (
            <>
              <InfoSection title="基本信息">
                {detail.customer.contact_name && <InfoRow label="联系人" value={detail.customer.contact_name} />}
                {detail.customer.contact_phone && <InfoRow label="电话" value={detail.customer.contact_phone} />}
                {detail.customer.contact_email && <InfoRow label="邮件" value={detail.customer.contact_email} />}
                {detail.customer.industry && <InfoRow label="行业" value={detail.customer.industry} />}
                {detail.customer.notes && <InfoRow label="备注" value={detail.customer.notes} />}
              </InfoSection>

              {detail.interactions.length > 0 && (
                <InfoSection title="沟通记录">
                  <div className="space-y-2">
                    {detail.interactions.map(i => (
                      <div key={i.id} className="text-sm bg-slate-50 rounded-2xl p-3">
                        <p className="text-slate-700">{i.summary}</p>
                        {i.next_action && <p className="text-xs text-blue-600 mt-1">下一步：{i.next_action}</p>}
                        <p className="text-xs text-slate-400 mt-1">{i.user_name} · {i.created_at?.slice(0, 10)}</p>
                      </div>
                    ))}
                  </div>
                </InfoSection>
              )}

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

          <form onSubmit={addNote} className="space-y-2">
            <p className="text-xs font-semibold text-slate-500">添加沟通记录</p>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="记录本次沟通内容…" rows={3} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-blue-300 resize-none" />
            <input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="下一步行动（选填）" className="w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm outline-none focus:border-blue-300" />
            <Button type="submit" size="sm" pill disabled={!note.trim()}>保存记录</Button>
          </form>
        </div>
      </div>
    </div>
  )
}

function InfoSection({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 mb-2">{title}</p>
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
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4">
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
            <Button type="button" variant="secondary" pill onClick={onClose} className="flex-1">取消</Button>
            <Button type="submit" pill loading={loading} className="flex-1">添加</Button>
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

const INPUT_CLASS = 'w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm outline-none focus:border-blue-300 bg-white'
