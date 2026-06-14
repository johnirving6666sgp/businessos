import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api/client.js'
import { Button } from '../components/ui/Button.jsx'
import { Badge } from '../components/ui/Badge.jsx'

// ── 类型配置 ──────────────────────────────────────────────────
const TYPE_META = {
  conversation: { icon: '💬', label: '对话', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  activity:     { icon: '📌', label: '活动', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  note:         { icon: '📝', label: '笔记', color: 'bg-green-50 text-green-700 border-green-200' },
  pull_to_chat: { icon: '🔗', label: '拉入对话', color: 'bg-violet-50 text-violet-700 border-violet-200' },
}

const FILTERS = [
  { key: '', label: '全部' },
  { key: 'conversation', label: '💬 对话' },
  { key: 'activity',     label: '📌 活动' },
  { key: 'note',         label: '📝 笔记' },
  { key: 'pull_to_chat', label: '🔗 拉入对话' },
]

// ── 主组件 ────────────────────────────────────────────────────
export function Archive({ onNavigate }) {
  const [memories, setMemories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [q, setQ] = useState('')
  const [pinned, setPinned] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [archivingConvId, setArchivingConvId] = useState(null)
  const searchRef = useRef(null)
  const debounceRef = useRef(null)

  const load = useCallback(async (params = {}) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        type: params.filter ?? filter,
        q: params.q ?? q,
        pinned: (params.pinned ?? pinned) ? '1' : '',
        limit: '50',
      }).toString()
      const data = await api.get(`/api/memories?${qs}`)
      setMemories(data.memories || [])
      setTotal(data.total || 0)
    } catch {}
    setLoading(false)
  }, [filter, q, pinned])

  useEffect(() => { load() }, [filter, pinned])

  function handleSearch(val) {
    setQ(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load({ q: val }), 350)
  }

  async function togglePin(mem) {
    await api.patch(`/api/memories/${mem.id}`, { is_pinned: !mem.is_pinned })
    setMemories(prev => prev.map(m =>
      m.id === mem.id ? { ...m, is_pinned: !m.is_pinned } : m
    ))
  }

  async function deleteMemory(id) {
    if (!confirm('确认删除这条记录？')) return
    await api.delete(`/api/memories/${id}`)
    setMemories(prev => prev.filter(m => m.id !== id))
    if (expanded === id) setExpanded(null)
  }

  // 手动归档当前对话
  async function archiveConversation(convId) {
    setArchivingConvId(convId)
    try {
      const res = await api.post(`/api/memories/from-conversation/${convId}`)
      if (res.ok) await load()
    } catch {}
    setArchivingConvId(null)
  }

  // 按日期分组
  const grouped = groupByDate(memories)

  return (
    <div className="flex flex-col h-full">

      {/* 顶部栏 */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">个人档案</h1>
            <p className="text-xs text-slate-400 mt-0.5">对话记录 · 活动轨迹 · 知识笔记 · {total} 条</p>
          </div>
          <Button size="sm" onClick={() => setShowNoteModal(true)}>
            ✏️ 新建笔记
          </Button>
        </div>

        {/* 搜索 */}
        <input
          ref={searchRef}
          value={q}
          onChange={e => handleSearch(e.target.value)}
          placeholder="搜索标题、内容、关联实体..."
          className="w-full mb-3 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />

        {/* 过滤栏 */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setPinned(!pinned)}
            className={`ml-auto px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              pinned ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            📌 仅看置顶
          </button>
        </div>
      </div>

      {/* 时间线内容 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : memories.length === 0 ? (
          <EmptyState filter={filter} q={q} onNavigate={onNavigate} />
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{date}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="space-y-2">
                  {items.map(mem => (
                    <MemoryCard
                      key={mem.id}
                      mem={mem}
                      expanded={expanded === mem.id}
                      onExpand={() => setExpanded(expanded === mem.id ? null : mem.id)}
                      onTogglePin={() => togglePin(mem)}
                      onDelete={() => deleteMemory(mem.id)}
                      onNavigate={onNavigate}
                      onArchiveConv={archiveConversation}
                      archiving={archivingConvId === mem.conv_id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNoteModal && (
        <NoteModal
          onClose={() => setShowNoteModal(false)}
          onSaved={() => { setShowNoteModal(false); load() }}
        />
      )}
    </div>
  )
}

// ── 记忆卡片 ──────────────────────────────────────────────────
function MemoryCard({ mem, expanded, onExpand, onTogglePin, onDelete, onNavigate }) {
  const meta = TYPE_META[mem.type] || TYPE_META.note

  return (
    <div className={`bg-white rounded-xl border transition-shadow ${
      expanded ? 'shadow-md border-slate-300' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
    }`}>
      {/* 卡片头部 */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={onExpand}
      >
        <div className="w-8 h-8 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.color}`}>
              {meta.label}
            </span>
            {mem.entity_name && (
              <span className="text-xs text-slate-500 truncate max-w-[180px]">
                📎 {mem.entity_name}
              </span>
            )}
            {mem.is_pinned && <span className="text-xs text-amber-500">📌</span>}
          </div>
          <p className="text-sm font-medium text-slate-800 leading-snug">{mem.title}</p>
          {!expanded && mem.content && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{mem.content.slice(0, 100)}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xs text-slate-400">{formatTime(mem.created_at)}</span>
          <div className="text-slate-300 text-xs mt-1">{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          {mem.content && (
            <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3">
              {mem.content}
            </div>
          )}

          {/* 关联实体跳转 */}
          {mem.entity_type && mem.entity_id && (
            <button
              onClick={() => onNavigate?.(mem.entity_type === 'opportunity' ? 'opportunities' : mem.entity_type + 's')}
              className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              → 查看关联{mem.entity_type === 'opportunity' ? '线索' : '客户'}：{mem.entity_name}
            </button>
          )}

          {/* 关联对话跳转 */}
          {mem.conv_id && (
            <button
              onClick={() => onNavigate?.('chat')}
              className="mt-1 text-xs text-violet-600 hover:underline flex items-center gap-1"
            >
              → 进入关联对话
            </button>
          )}

          {/* 标签 */}
          {mem.tags?.length > 0 && (
            <div className="flex gap-1 mt-3 flex-wrap">
              {mem.tags.map(t => (
                <Badge key={t} variant="gray">{t}</Badge>
              ))}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onTogglePin}
              className="text-xs text-slate-500 hover:text-amber-500 transition-colors px-2 py-1 rounded hover:bg-amber-50"
            >
              {mem.is_pinned ? '取消置顶' : '📌 置顶'}
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 新建笔记 Modal ────────────────────────────────────────────
function NoteModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', content: '', tags: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await api.post('/api/memories', {
        type: 'note',
        title: form.title.trim(),
        content: form.content.trim() || null,
        tags: form.tags ? form.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : [],
      })
      onSaved()
    } catch {}
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">✏️ 新建笔记</h3>
        <div className="space-y-3">
          <input
            autoFocus
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="标题（必填）"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <textarea
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="内容、洞察、心得..."
            rows={5}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
          />
          <input
            value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="标签，逗号分隔（可选）"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 空状态 ────────────────────────────────────────────────────
function EmptyState({ filter, q, onNavigate }) {
  if (q) return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-4xl mb-3">🔍</div>
      <p className="text-sm">没有找到「{q}」相关的记录</p>
    </div>
  )
  return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-5xl mb-4">🗂️</div>
      <h3 className="text-base font-semibold text-slate-600 mb-1">档案还是空的</h3>
      <p className="text-sm mb-4">
        {filter
          ? `暂无「${TYPE_META[filter]?.label}」类型的记录`
          : '把线索拉进对话、或新建笔记，记录就会出现在这里'}
      </p>
      {!filter && (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => onNavigate?.('opportunities')}
            className="text-sm text-blue-600 hover:underline"
          >
            去线索池 →
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={() => onNavigate?.('chat')}
            className="text-sm text-violet-600 hover:underline"
          >
            去对话 →
          </button>
        </div>
      )}
    </div>
  )
}

// ── 工具函数 ──────────────────────────────────────────────────
function groupByDate(items) {
  const groups = {}
  for (const item of items) {
    const d = new Date(item.created_at)
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

    let label
    if (isSameDay(d, today)) label = '今天'
    else if (isSameDay(d, yesterday)) label = '昨天'
    else label = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })

    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }
  return groups
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function formatTime(str) {
  if (!str) return ''
  const d = new Date(str)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
