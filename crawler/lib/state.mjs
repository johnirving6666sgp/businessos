/**
 * 本地状态管理：跟踪已处理的 URL，避免重复爬取
 * 使用 JSON 文件存储（适合 GitHub Actions 跨 run 时通过 cache 持久化）
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const STATE_FILE = join(process.cwd(), 'crawler', '.state.json')

/**
 * 加载状态
 * @returns {{ seen: string[], stats: object }}
 */
export function loadState() {
  if (!existsSync(STATE_FILE)) {
    return { seen: [], stats: { total: 0, pushed: 0, skipped: 0, errors: 0 } }
  }
  try {
    const raw = readFileSync(STATE_FILE, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { seen: [], stats: { total: 0, pushed: 0, skipped: 0, errors: 0 } }
  }
}

/**
 * 保存状态到文件
 */
export function saveState(state) {
  // 只保留最近 5000 个 URL，防止文件无限增长
  if (state.seen.length > 5000) {
    state.seen = state.seen.slice(-5000)
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

/**
 * 检查 URL 是否已处理
 */
export function isSeen(state, url) {
  return state.seen.includes(url)
}

/**
 * 标记 URL 为已处理
 */
export function markSeen(state, url) {
  if (!state.seen.includes(url)) {
    state.seen.push(url)
  }
}

/**
 * 更新统计数据
 */
export function updateStats(state, key) {
  if (state.stats[key] !== undefined) {
    state.stats[key]++
  }
  state.stats.lastRun = new Date().toISOString()
}

/**
 * 打印运行统计
 */
export function printStats(state) {
  const { total, pushed, skipped, errors, lastRun } = state.stats
  console.log('\n📊 本次运行统计:')
  console.log(`  总计扫描页面: ${total}`)
  console.log(`  推送线索数:   ${pushed}`)
  console.log(`  跳过已知URL:  ${skipped}`)
  console.log(`  错误数:       ${errors}`)
  console.log(`  最后运行:     ${lastRun}`)
}
