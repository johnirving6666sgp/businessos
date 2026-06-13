/**
 * 初始用户 Seed 脚本
 * 用法：node scripts/seed.mjs --local | --remote
 *
 * 密码哈希：PBKDF2-SHA256（与 worker/lib/auth.mjs 一致）
 */

import { execSync } from 'child_process'
import crypto from 'crypto'

const args = process.argv.slice(2)
const isRemote = args.includes('--remote')
const flag = isRemote ? '--remote' : '--local'

async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, dk) => {
      if (err) reject(err)
      else resolve(dk)
    })
  })
  return `${salt.toString('hex')}:${key.toString('hex')}`
}

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

const users = [
  {
    id: 'user_jamie',
    username: 'jamie',
    display_name: 'Jamie',
    password: 'jamie-demo',
    role: 'super_admin',
    model_tier: 'opus',
    permissions: JSON.stringify({ agents: true, customers: true, tasks: true, quote: true, quoteTraining: true, insight: true }),
  },
  {
    id: 'user_larry',
    username: 'larry',
    display_name: 'Larry',
    password: 'demo',
    role: 'member',
    model_tier: 'opus',
    permissions: JSON.stringify({ agents: true, customers: true, tasks: true, quote: true, quoteTraining: false, insight: true }),
  },
  {
    id: 'user_gu',
    username: 'gu',
    display_name: 'Gu',
    password: 'demo',
    role: 'member',
    model_tier: 'opus',
    permissions: JSON.stringify({ agents: true, customers: false, tasks: true, quote: true, quoteTraining: false, insight: false }),
  },
  {
    id: 'user_xiaodong',
    username: 'xiaodong',
    display_name: 'Xiaodong',
    password: 'demo',
    role: 'member',
    model_tier: 'opus',
    permissions: JSON.stringify({ agents: true, customers: true, tasks: true, quote: false, quoteTraining: false, insight: false }),
  },
  {
    id: 'user_heli',
    username: 'heli',
    display_name: 'Heli',
    password: 'demo',
    role: 'member',
    model_tier: 'haiku',
    permissions: JSON.stringify({ agents: true, customers: false, tasks: true, quote: false, quoteTraining: false, insight: false }),
  },
  {
    id: 'user_guihua',
    username: 'guihua',
    display_name: 'Guihua',
    password: 'demo',
    role: 'member',
    model_tier: 'haiku',
    permissions: JSON.stringify({ agents: true, customers: false, tasks: true, quote: false, quoteTraining: false, insight: false }),
  },
  {
    id: 'user_zhiping',
    username: 'zhiping',
    display_name: 'Zhiping',
    password: 'demo',
    role: 'member',
    model_tier: 'sonnet',
    permissions: JSON.stringify({ agents: true, customers: false, tasks: true, quote: true, quoteTraining: false, insight: false }),
  },
  {
    id: 'user_luyang',
    username: 'luyang',
    display_name: 'Luyang',
    password: 'demo',
    role: 'member',
    model_tier: 'sonnet',
    permissions: JSON.stringify({ agents: true, customers: true, tasks: true, quote: false, quoteTraining: false, insight: false }),
  },
  {
    id: 'user_kingsong',
    username: 'kingsong',
    display_name: 'Kingsong',
    password: 'demo',
    role: 'member',
    model_tier: 'sonnet',
    permissions: JSON.stringify({ agents: true, customers: false, tasks: true, quote: true, quoteTraining: false, insight: false }),
  },
]

async function main() {
  console.log(`Seeding users (${isRemote ? 'remote' : 'local'} D1)...`)

  for (const user of users) {
    const hash = await hashPassword(user.password)
    const sql = `INSERT OR REPLACE INTO users (id, username, display_name, password_hash, role, model_tier, permissions) VALUES ('${user.id}', '${user.username}', '${user.display_name}', '${hash}', '${user.role}', '${user.model_tier}', '${user.permissions.replace(/'/g, "''")}');`

    const tmpFile = `/tmp/seed_${user.username}.sql`
    const fs = await import('fs')
    fs.default.writeFileSync(tmpFile, sql)

    try {
      execSync(`npx wrangler d1 execute business-os-db ${flag} --file=${tmpFile}`, { stdio: 'pipe' })
      console.log(`  ✓ ${user.display_name} (${user.username})`)
    } catch (e) {
      console.error(`  ✗ ${user.username}: ${e.stderr?.toString() || e.message}`)
    }

    fs.default.unlinkSync(tmpFile)
  }

  // Seed agent configs
  for (const user of users) {
    const sql = `INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_${user.id}', '${user.id}', 'personal');`
    const tmpFile = `/tmp/seed_ac_${user.username}.sql`
    const fs = await import('fs')
    fs.default.writeFileSync(tmpFile, sql)
    try {
      execSync(`npx wrangler d1 execute business-os-db ${flag} --file=${tmpFile}`, { stdio: 'pipe' })
    } catch {}
    fs.default.unlinkSync(tmpFile)
  }

  console.log('Done.')
}

main().catch(console.error)
