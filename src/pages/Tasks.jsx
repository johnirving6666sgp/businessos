import { useState, useEffect } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { useUIStore } from '../store/ui.js'
import { TaskStatusBadge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

const STATUSES = ['todo', 'in_progress', 'waiting', 'done', 'closed']
const STATUS_LABELS = { todo: '待办', in_progress: '进行中', waiting: '等待反馈', done: '已完成', closed: '已关闭' }
const PRIORITY_META = { high: { label: '高', color: 'text-red-500' }, normal: { label: '中', color: 'text-slate-400' }, low: { label: '低', color: 'text-slate-300' } }

export function Tasks() {
  const user = useAuthStore(s => s.user)
  const toast = useUIStore(s => s.toast)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMine, setFilterMine] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterMine) params.set('mine', 'true')
      if (filterStatus) params.set('status', filterStatus)
      const data = await api.get(`/api/tasks?${params}`)
      setTasks(data.tasks)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterMine, filterStatus])

  async function updateStatus(taskId, status) {
    await api.patch(`/api/tasks/${taskId}`, { status })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    toast('状态已更新', 'success')
  }

  // 按状态分组
  const activeStatuses = ['todo', 'in_progress', 'waiting']
  const grouped = activeStatuses.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-800">任务看板</h1>
          <p className="text-xs text-slate-400">{tasks.length} 个进行中</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMine(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterMine ? 'bg-blue-500 text-white border-blue-500' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            只看我的
          </button>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ 创建</Button>
        </div>
      </div>

      {/* 状态筛选 */}
      <div className="flex gap-1.5 px-4 py-2 bg-white border-b border-slate-50 overflow-x-auto">
        <button
          onClick={() => setFilterStatus('')}
          className={`text-xs px-3 py-1 rounded-full flex-shrink-0 transition-colors ${!filterStatus ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          全部
        </button>
        {STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`text-xs px-3 py-1 rounded-full flex-shrink-0 transition-colors ${filterStatus === s ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* 任务列表 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {filterStatus ? (
            /* 筛选视图 */
            <div className="space-y-2">
              {tasks.map(t => (
                <TaskCard key={t.id} task={t} onStatusChange={updateStatus} />
              ))}
            </div>
          ) : (
            /* 分组视图 */
            activeStatuses.map(status => (
              grouped[status].length > 0 && (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    <TaskStatusBadge status={status} />
                    <span className="text-xs text-slate-400">{grouped[status].length}</span>
                  </div>
                  <div className="space-y-2">
                    {grouped[status].map(t => (
                      <TaskCard key={t.id} task={t} onStatusChange={updateStatus} />
                    ))}
                  </div>
                </div>
              )
            ))
          )}

          {tasks.length === 0 && !loading && (
            <div className="text-center py-16 text-slate-400">
              <div className="text-4xl mb-3">✅</div>
              <p>{filterMine ? '你没有待办任务' : '暂无任务'}</p>
            </div>
          )}
        </div>
      )}

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} onAdd={load} />}
    </div>
  )
}

function TaskCard({ task, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const pri = PRIORITY_META[task.priority] || PRIORITY_META.normal
  const isOverdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done'

  const nextStatuses = {
    todo: ['in_progress'],
    in_progress: ['waiting', 'done'],
    waiting: ['in_progress', 'done'],
  }[task.status] || []

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
      isOverdue ? 'border-red-200' : 'border-slate-100'
    } shadow-sm hover:shadow`}>
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        {/* 优先级指示 */}
        <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
          task.priority === 'high' ? 'bg-red-400' : task.priority === 'low' ? 'bg-slate-200' : 'bg-blue-300'
        }`} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 leading-snug">{task.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.assignee_name && <span className="text-xs text-slate-400">→ {task.assignee_name}</span>}
            {task.customer_name && <span className="text-xs text-blue-400">{task.customer_name}</span>}
            {task.due_date && (
              <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                {isOverdue ? '⚠ ' : ''}{task.due_date}
              </span>
            )}
            {task.source_type && task.source_type !== 'manual' && (
              <span className="text-xs text-slate-300">来自{SOURCE_LABELS[task.source_type] || task.source_type}</span>
            )}
          </div>
        </div>

        <TaskStatusBadge status={task.status} />
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-50 pt-2 space-y-2">
          {task.description && (
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2">{task.description}</p>
          )}
          {nextStatuses.length > 0 && (
            <div className="flex gap-2">
              {nextStatuses.map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant="secondary"
                  onClick={() => onStatusChange(task.id, s)}
                >
                  → {STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SOURCE_LABELS = {
  conversation: '对话', opportunity: '商机', broadcast: '广播', proposal: '方案', manual: '手动'
}

function AddTaskModal({ onClose, onAdd }) {
  const toast = useUIStore(s => s.toast)
  const user = useAuthStore(s => s.user)
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', due_date: '', assignee_id: user?.id })
  const [loading, setLoading] = useState(false)
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    try {
      await api.post('/api/tasks', { ...form, source_type: 'manual' })
      toast('任务已创建', 'success')
      onAdd()
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md p-5 space-y-4">
        <h2 className="font-bold text-slate-800">创建任务</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={form.title}
            onChange={e => update('title', e.target.value)}
            placeholder="任务标题 *"
            className={INPUT_CLASS}
            required
            autoFocus
          />
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            placeholder="详细描述（选填）"
            rows={2}
            className={INPUT_CLASS + ' resize-none'}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">优先级</label>
              <select value={form.priority} onChange={e => update('priority', e.target.value)} className={INPUT_CLASS}>
                <option value="high">🔴 高</option>
                <option value="normal">🟡 中</option>
                <option value="low">⚪ 低</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">截止日期</label>
              <input type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">取消</Button>
            <Button type="submit" loading={loading} className="flex-1">创建</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const INPUT_CLASS = 'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-300 bg-white'
