/**
 * 直接写入本地 SQLite（.data/local.db）
 * 使用与 worker/lib/auth.mjs 完全相同的 Web Crypto 哈希算法
 * 用法：node scripts/seed-local.mjs
 */

import Database from 'better-sqlite3'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const DATA_DIR = resolve(ROOT, '.data')
const DB_PATH = resolve(DATA_DIR, 'local.db')
const MIGRATION = resolve(ROOT, 'migrations/0001_init.sql')

// 确保目录存在
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 运行 migration（幂等）
if (existsSync(MIGRATION)) {
  db.exec(readFileSync(MIGRATION, 'utf-8'))
  console.log('✓ Migration 完成')
}

// 与 worker/lib/auth.mjs 完全相同的哈希实现（Web Crypto，Node.js 18+ 全局可用）
async function hashPassword(password) {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

const users = [
  { id: 'user_jamie',    username: 'jamie',    display_name: 'Jamie',    password: 'jamie-demo', role: 'super_admin', model_tier: 'opus',   perms: { agents: true, customers: true, tasks: true, quote: true, quoteTraining: true, insight: true } },
  { id: 'user_larry',    username: 'larry',    display_name: 'Larry',    password: 'demo',       role: 'member',      model_tier: 'opus',   perms: { agents: true, customers: true, tasks: true, quote: true, quoteTraining: false, insight: true } },
  { id: 'user_gu',       username: 'gu',       display_name: 'Gu',       password: 'demo',       role: 'member',      model_tier: 'opus',   perms: { agents: true, customers: false, tasks: true, quote: true, quoteTraining: false, insight: false } },
  { id: 'user_xiaodong', username: 'xiaodong', display_name: 'Xiaodong', password: 'demo',       role: 'member',      model_tier: 'opus',   perms: { agents: true, customers: true, tasks: true, quote: false, quoteTraining: false, insight: false } },
  { id: 'user_heli',     username: 'heli',     display_name: 'Heli',     password: 'demo',       role: 'member',      model_tier: 'haiku',  perms: { agents: true, customers: false, tasks: true, quote: false, quoteTraining: false, insight: false } },
  { id: 'user_guihua',   username: 'guihua',   display_name: 'Guihua',   password: 'demo',       role: 'member',      model_tier: 'haiku',  perms: { agents: true, customers: false, tasks: true, quote: false, quoteTraining: false, insight: false } },
  { id: 'user_zhiping',  username: 'zhiping',  display_name: 'Zhiping',  password: 'demo',       role: 'member',      model_tier: 'sonnet', perms: { agents: true, customers: false, tasks: true, quote: true, quoteTraining: false, insight: false } },
  { id: 'user_luyang',   username: 'luyang',   display_name: 'Luyang',   password: 'demo',       role: 'member',      model_tier: 'sonnet', perms: { agents: true, customers: true, tasks: true, quote: false, quoteTraining: false, insight: false } },
  { id: 'user_kingsong', username: 'kingsong', display_name: 'Kingsong', password: 'demo',       role: 'member',      model_tier: 'sonnet', perms: { agents: true, customers: false, tasks: true, quote: true, quoteTraining: false, insight: false } },
]

const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users (id, username, display_name, password_hash, role, model_tier, permissions)
  VALUES (@id, @username, @display_name, @password_hash, @role, @model_tier, @permissions)
`)
const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type)
  VALUES (@id, @user_id, 'personal')
`)

console.log('\nSeeding → .data/local.db\n')

for (const u of users) {
  const hash = await hashPassword(u.password)
  insertUser.run({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    password_hash: hash,
    role: u.role,
    model_tier: u.model_tier,
    permissions: JSON.stringify(u.perms),
  })
  insertAgent.run({ id: `ac_${u.id}`, user_id: u.id })
  console.log(`  ✓  ${u.display_name.padEnd(10)} ${u.username} / ${u.password}`)
}

db.close()
console.log('\n✅ 完成。重启 server 后即可登录。\n')
