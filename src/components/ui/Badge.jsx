export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    violet: 'bg-violet-50 text-violet-700',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${variants[variant] || variants.default} ${className}`}>
      {children}
    </span>
  )
}

// 阶段 badge
export const STAGE_META = {
  untouched: { label: '未接触', variant: 'gray' },
  contacted: { label: '已接触', variant: 'blue' },
  interested: { label: '有意向', variant: 'violet' },
  quoting: { label: '待报价', variant: 'amber' },
  closing: { label: '待成交', variant: 'amber' },
  won: { label: '已成交', variant: 'green' },
  lost: { label: '已流失', variant: 'red' },
}

export function StageBadge({ stage }) {
  const meta = STAGE_META[stage] || { label: stage, variant: 'gray' }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

// 任务状态 badge
export const TASK_STATUS_META = {
  todo: { label: '待办', variant: 'gray' },
  in_progress: { label: '进行中', variant: 'blue' },
  waiting: { label: '等待反馈', variant: 'amber' },
  done: { label: '已完成', variant: 'green' },
  closed: { label: '已关闭', variant: 'gray' },
}

export function TaskStatusBadge({ status }) {
  const meta = TASK_STATUS_META[status] || { label: status, variant: 'gray' }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

// 评分 badge
export function RatingBadge({ score }) {
  if (score == null) return null
  const color = score >= 80 ? 'green' : score >= 60 ? 'blue' : score >= 30 ? 'amber' : 'red'
  return <Badge variant={color}>{score}分</Badge>
}
