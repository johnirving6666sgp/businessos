#!/usr/bin/env node
/**
 * 远程 D1 迁移器（幂等、可容错）
 *
 * 与 server.mjs 的本地迁移逻辑一致：用远程 D1 上的 _migrations 表追踪，
 * 每个迁移文件只执行一次。额外容忍 "duplicate column name / already exists"
 * 这类错误——因为远程库历史上是手动零散迁移过的，某些列/表可能已存在。
 *
 * 用法（需要 CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID 环境变量）：
 *   node scripts/migrate-remote.mjs
 */

import { readdirSync, readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const MIGRATIONS_DIR = join(ROOT, 'migrations')
const DB = 'business-os-db'

const TOLERABLE = /duplicate column name|already exists/i

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function execCommand(sql) {
  return wrangler(['d1', 'execute', DB, '--remote', '--json', '--command', sql])
}

function execFile(relPath) {
  return wrangler(['d1', 'execute', DB, '--remote', '--json', '--file', relPath])
}

function parseRows(out) {
  try {
    const json = JSON.parse(out)
    const block = Array.isArray(json) ? json[0] : json
    return block?.results || []
  } catch {
    return []
  }
}

// 1. 确保追踪表存在
execCommand("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))")

// 2. 读取已应用的迁移
let applied = new Set()
try {
  applied = new Set(parseRows(execCommand('SELECT name FROM _migrations')).map(r => r.name))
} catch { /* 表刚建，空集 */ }

// 3. 按序应用未执行的迁移
const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
let appliedCount = 0

for (const file of files) {
  if (applied.has(file)) {
    console.log(`⏭️  ${file}（已应用）`)
    continue
  }
  try {
    execFile(join('migrations', file))
    console.log(`✅ ${file}`)
    appliedCount++
  } catch (e) {
    const msg = `${e.stderr || ''}${e.stdout || ''}${e.message || ''}`
    if (TOLERABLE.test(msg)) {
      console.log(`☑️  ${file}（列/表已存在，视为已应用）`)
    } else {
      console.error(`❌ ${file} 执行失败：\n${msg}`)
      process.exit(1)
    }
  }
  // 记录为已应用（文件名来自受控的 migrations 目录，安全）
  execCommand(`INSERT OR IGNORE INTO _migrations (name) VALUES ('${file}')`)
}

console.log(`\n迁移完成：本次新应用 ${appliedCount} 个，共 ${files.length} 个。`)
