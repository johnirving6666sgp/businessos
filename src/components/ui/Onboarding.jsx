import { useState } from 'react'
import { Icon } from './Icon.jsx'

const KEY = 'bizos_onboarding_dismissed'

const STEPS = [
  { page: 'opportunities', icon: 'target', title: '挑一个线索', desc: '从线索池选感兴趣的商机' },
  { page: 'customers', icon: 'users', title: '转成客户', desc: '加进客户开始跟进' },
  { page: 'proposals', icon: 'file', title: '出方案报价', desc: '让方案工程师帮你' },
]

// 新手 3 步引导。完成情况按真实数据传入（done 数组），用户可手动收起，记忆在本地。
export function Onboarding({ onNavigate, done = [false, false, false] }) {
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })
  if (hidden) return null

  const doneCount = done.filter(Boolean).length
  if (doneCount === STEPS.length) return null

  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch { /* 隐私模式下忽略 */ }
    setHidden(true)
  }

  // 第一个未完成的步骤高亮为“下一步”
  const nextIndex = done.findIndex(d => !d)

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-3xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="rocket" size={18} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-800">3 步开始使用</span>
          <span className="text-xs text-blue-500">完成 {doneCount} / {STEPS.length}</span>
        </div>
        <button onClick={dismiss} aria-label="不再提示" className="w-7 h-7 flex items-center justify-center rounded-full text-blue-400 hover:bg-blue-100">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {STEPS.map((s, i) => {
          const isDone = done[i]
          const isNext = i === nextIndex
          return (
            <button
              key={s.page}
              onClick={() => onNavigate(s.page)}
              className={`w-full flex items-center gap-3 bg-white rounded-2xl px-3.5 py-3 text-left transition-colors hover:bg-slate-50 ${
                isNext ? 'border border-blue-300' : 'border border-transparent'
              }`}
            >
              <span className={isDone ? 'text-emerald-500' : isNext ? 'text-blue-500' : 'text-slate-300'}>
                <Icon name={isDone ? 'circle-check' : 'circle'} size={22} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-slate-800 leading-tight">{s.title}</span>
                <span className="block text-xs text-slate-400 leading-tight mt-0.5">{s.desc}</span>
              </span>
              {isNext && <Icon name="arrow-right" size={16} className="text-blue-500" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
