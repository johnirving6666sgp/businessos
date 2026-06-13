/**
 * 从本地 SQLite 导出用户数据为 SQL 文件
 * 用于远程 D1 数据库初始化
 * 用法：node scripts/export-users-sql.mjs
 */

import Database from 'better-sqlite3'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const DB_PATH = resolve(ROOT, '.data/local.db')
const OUT_PATH = resolve(ROOT, 'migrations/0002_users.sql')

const db = new Database(DB_PATH, { readonly: true })

const users = db.prepare('SELECT * FROM users').all()
const agents = db.prepare('SELECT * FROM agent_configs').all()

const lines = [
  '-- BusinessOS v2.0 - 用户数据（从本地导出，含哈希密码）',
  '-- 用法：npx wrangler d1 execute business-os-db --remote --file=migrations/0002_users.sql',
  '',
  '-- 用户',
]

for (const u of users) {
  lines.push(
    `INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ` +
    `('${u.id}', '${u.username}', '${u.display_name}', '${u.password_hash}', '${u.role}', '${u.model_tier}', '${u.permissions}', ${u.is_active});`
  )
}

lines.push('', '-- Agent 配置')
for (const a of agents) {
  lines.push(
    `INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('${a.id}', '${a.user_id}', '${a.agent_type}');`
  )
}

writeFileSync(OUT_PATH, lines.join('\n') + '\n')
db.close()

console.log(`✅ 已导出 ${users.length} 个用户到 ${OUT_PATH}`)
console.log('\n下一步运行：')
console.log('  npx wrangler d1 execute business-os-db --remote --file=migrations/0002_users.sql')
console.log('  npx wrangler d1 execute business-os-db --remote --file=migrations/0003_demo_data.sql')
