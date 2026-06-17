import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { useUIStore } from '../store/ui.js'
import { Button } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'

const VISIBILITY_LABELS = { private: '仅自己', team: '团队', public: '公开' }
const SOURCE_LABELS = { conversation: '对话提炼', task: '任务总结', proposal: '方案沉淀', manual: '手动录入' }

export function Knowledge({ onNavigate }) {
  const user = useAuthStore(s => s.user)
  const toast = useUIStore(s => s.toast)

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [allTags, setAllTags] = useState([])
  const searchTimer = useRef(null)

  async function load(q = search, tag = tagFilter) {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: 1, limit: 30 })
      if (q) qs.set('q', q)
      if (tag) qs.set('tag', tag)
      const data = await api.get(`/api/knowledge?${qs}`)
      setItems(data.items)
      setTotal(data.total)
      const tags = new Set()
      data.items.forEach(item => (item.tags || []).forEach(t => tags.add(t)))
      setAllTags([...tags])
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function handleSearchChange(v) {
    setSearch(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => load(v, tagFilter), 350)
  }

  async function handleCreate(form) {
    try {
      await api.post('/api/knowledge', form)
      toast('知识条目已创建', 'success')
      setShowCreate(false)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="flex h-full">
      <div className={`flex flex-col ${selected ? 'w-80 flex-shrink-0 border-r border-slate-100' : 'flex-1'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Icon name="book" size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">知识库</h1>
              <p className="text-xs text-slate-400">{total} 条沉淀的经验</p>
            </div>
          </div>
          <Button size="sm" pill onClick={() => setShowCreate(true)} icon={<Icon name="plus" size={15} />}>新建</Button>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" size={16} /></span>
            <input
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="搜索标题或内容…"
              className="w-full border border-slate-200 rounded-full pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-100 bg-white flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => { setTagFilter(''); load(search, '') }}
              className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${!tagFilter ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              全部
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => { setTagFilter(tag); load(search, tag) }}
                className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${tagFilter === tag ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-3 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-50 rounded w-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 m-4 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                <Icon name="book" size={28} />
              </div>
              <p className="text-sm font-medium text-slate-700">{search ? `未找到“${search}”` : '还没有知识沉淀'}</p>
              <p className="text-xs text-slate-400 mt-1">{search ? '换个关键词试试' : '把经验记下来，团队都能用'}</p>
            </div>
          )}

          <div className="p-3 space-y-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelected(selected?.id === item.id ? null : item)}
                className={`w-full text-left p-3 rounded-2xl border transition-all ${
                  selected?.id === item.id ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800 leading-snug flex-1 min-w-0">{item.title}</span>
                  {item.source_type && item.source_type !== 'manual' && (
                    <span className="text-xs text-slate-400 flex-shrink-0">{SOURCE_LABELS[item.source_type] || item.source_type}</span>
                  )}
                </div>
                {item.content_preview && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.content_preview}</p>}
                {item.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">#{tag}</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-300 mt-1.5">{item.author_name} · {new Date(item.updated_at).toLocaleDateString('zh-CN')}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selected && (
        <KnowledgeDetail item={selected} onClose={() => setSelected(null)} onNavigate={onNavigate} currentUserId={user?.id} toast={toast} onDeleted={() => { setSelected(null); load() }} />
      )}

      {showCreate && <CreateKnowledgeModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  )
}

function KnowledgeDetail({ item, onClose, onNavigate, currentUserId, toast, onDeleted }) {
  const [full, setFull] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/knowledge/${item.id}`)
      .then(setFull)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [item.id])

  const data = full || item

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-start justify-between px-5 py-3 border-b border-slate-100 flex-shrink-0 bg-white gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800 leading-snug">{data.title}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">{data.author_name}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{new Date(data.updated_at).toLocaleDateString('zh-CN')}</span>
            {data.visibility && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{VISIBILITY_LABELS[data.visibility] || data.visibility}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="agent"
            pill
            icon={<Icon name="message" size={15} />}
            onClick={() => {
              onNavigate?.('chat')
              toast('已跳转到 AI 对话，可继续深化这条知识', 'success')
            }}
          >
            深化讨论
          </Button>
          <button onClick={onClose} aria-label="关闭" className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Icon name="x" size={18} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-5/6" />
            <div className="h-4 bg-slate-100 rounded w-4/5" />
          </div>
        ) : (
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data.content}</p>
        )}

        {data.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-slate-100">
            {data.tags.map(tag => (
              <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        {data.source_type && (
          <p className="text-xs text-slate-400 mt-4">来源：{SOURCE_LABELS[data.source_type] || data.source_type}</p>
        )}
      </div>
    </div>
  )
}

function CreateKnowledgeModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ title: '', content: '', tags: '', visibility: 'team' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    try {
      const tags = form.tags ? form.tags.split(/[,，\s]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean) : []
      await onCreate({ title: form.title, content: form.content, tags, visibility: form.visibility })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">新建知识条目</h3>
          <button onClick={onClose} aria-label="关闭" className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="标题 *">
            <input autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="如：VIM 真空感应熔炼炉常见故障处理手册" className={K_INPUT} />
          </Field>
          <Field label="内容 *">
            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={5} placeholder="详细内容、经验总结、操作步骤…" className={K_INPUT + ' resize-none'} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="标签（逗号分隔）">
              <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="真空熔炼, 故障, 维修" className={K_INPUT} />
            </Field>
            <Field label="可见范围">
              <select value={form.visibility} onChange={e => set('visibility', e.target.value)} className={K_INPUT + ' bg-white'}>
                <option value="private">仅自己</option>
                <option value="team">团队共享</option>
                <option value="public">公开</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" pill onClick={onClose}>取消</Button>
            <Button type="submit" pill loading={saving} disabled={!form.title.trim() || !form.content.trim()}>保存</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

const K_INPUT = 'w-full border border-slate-200 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}
