// 全站统一的导航配置，侧边栏与底部导航共用，避免分叉。
// perm 为空表示所有人可见；有 perm 时按 can(perm) 过滤。

export const NAV_GROUPS = [
  {
    label: '主页',
    items: [
      { id: 'dashboard', icon: 'home', label: '工作台' },
      { id: 'chat', icon: 'agent', label: '我的 Agent', hint: '你的 AI 助手', perm: 'agents' },
    ],
  },
  {
    label: '业务',
    items: [
      { id: 'opportunities', icon: 'target', label: '线索池', hint: '待挖掘的商机' },
      { id: 'customers', icon: 'users', label: '客户', hint: '在跟进的人', perm: 'customers' },
      { id: 'tasks', icon: 'tasks', label: '任务', perm: 'tasks' },
      { id: 'proposals', icon: 'file', label: '方案工程师', hint: '帮你出报价', perm: 'quote' },
    ],
  },
  {
    label: '知识',
    items: [
      { id: 'knowledge', icon: 'book', label: '知识库', perm: 'insight' },
      { id: 'archive', icon: 'folder', label: '个人档案' },
    ],
  },
]

export const ADMIN_GROUP = {
  label: '管理',
  items: [{ id: 'admin', icon: 'settings', label: 'Jamie Central', hint: '成员与权限' }],
}

// 移动端底部栏固定 4 项 + 中间 AI + “更多”
export const BOTTOM_PRIMARY = [
  { id: 'dashboard', icon: 'home', label: '工作台' },
  { id: 'opportunities', icon: 'target', label: '线索' },
]
export const BOTTOM_PRIMARY_RIGHT = [
  { id: 'customers', icon: 'users', label: '客户', perm: 'customers' },
]

// 收进“更多”抽屉的页面
export const MORE_ITEMS = [
  { id: 'tasks', icon: 'tasks', label: '任务', perm: 'tasks' },
  { id: 'proposals', icon: 'file', label: '方案工程师', hint: '帮你出报价', perm: 'quote' },
  { id: 'knowledge', icon: 'book', label: '知识库', perm: 'insight' },
  { id: 'archive', icon: 'folder', label: '个人档案' },
  { id: 'admin', icon: 'settings', label: 'Jamie Central', hint: '成员与权限', adminOnly: true },
]
