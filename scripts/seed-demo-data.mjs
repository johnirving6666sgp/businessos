/**
 * 业务演示数据 seed
 * 场景：真空熔炼/高温合金设备公司
 * 用法：node scripts/seed-demo-data.mjs
 */

import Database from 'better-sqlite3'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const DB_PATH = resolve(ROOT, '.data/local.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

function uid(prefix = '') {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return prefix ? `${prefix}_${hex}` : hex
}

console.log('\n📦 注入业务演示数据...\n')

// ── 客户 ───────────────────────────────────────────────────────

const customers = [
  {
    id: 'cust_001',
    name: '北京航空材料研究院',
    stage: 'quoting',
    owner_id: 'user_larry',
    industry: '航空航天',
    contact_name: '王志远',
    contact_phone: '13901234567',
    contact_email: 'wzyhang@biam.ac.cn',
    notes: '主攻钛合金和镍基高温合金，有年度采购计划。正在评估我们的VIM-200型真空感应熔炼炉。',
    source_opportunity_id: null,
  },
  {
    id: 'cust_002',
    name: '西北有色金属研究院',
    stage: 'interested',
    owner_id: 'user_xiaodong',
    industry: '稀有金属',
    contact_name: '李建国',
    contact_phone: '18992345678',
    contact_email: 'ljg@nwmti.cn',
    notes: '专注钼、钨、钽等难熔金属研究，对冷坩埚悬浮熔炼系统有强烈兴趣，预算约300-500万。',
    source_opportunity_id: null,
  },
  {
    id: 'cust_003',
    name: '江苏龙腾特种合金有限公司',
    stage: 'closing',
    owner_id: 'user_larry',
    industry: '特种合金制造',
    contact_name: '陈龙',
    contact_phone: '13712345678',
    contact_email: 'chenlong@ltalloy.com',
    notes: '民营特种合金厂，规模扩张中，已有设备老化需要升级。签单意愿强，最近在比价。',
    source_opportunity_id: null,
  },
  {
    id: 'cust_004',
    name: '中国科学院金属研究所',
    stage: 'contacted',
    owner_id: 'user_gu',
    industry: '科研院所',
    contact_name: '张敏',
    contact_phone: '024-83978888',
    contact_email: 'zhangmin@imr.ac.cn',
    notes: '国内最权威的金属所，采购流程长但体量大。有高熵合金研究项目，需要定制化方案。',
    source_opportunity_id: null,
  },
  {
    id: 'cust_005',
    name: '新加坡材料研究与工程研究院',
    stage: 'interested',
    owner_id: 'user_jamie',
    industry: '国际科研机构',
    contact_name: 'Dr. Chen Wei',
    contact_phone: '+65-6793-8200',
    contact_email: 'chen_wei@imre.a-star.edu.sg',
    notes: '东南亚重要科研机构，使用英语沟通。对真空悬浮熔炼技术有强烈兴趣，可能成为出口样板案例。',
    source_opportunity_id: null,
  },
]

const insertCustomer = db.prepare(`
  INSERT OR REPLACE INTO customers
    (id, name, stage, owner_id, industry, contact_name, contact_phone, contact_email, notes, source_opportunity_id)
  VALUES
    (@id, @name, @stage, @owner_id, @industry, @contact_name, @contact_phone, @contact_email, @notes, @source_opportunity_id)
`)

for (const c of customers) {
  insertCustomer.run(c)
  console.log(`  ✓ 客户  ${c.name}`)
}

// ── 客户互动记录 ───────────────────────────────────────────────

const interactions = [
  {
    id: uid('ci'),
    customer_id: 'cust_001',
    user_id: 'user_larry',
    type: 'meeting',
    summary: '赴京拜访，确认VIM-200型号需求，对方对自动化控制系统有额外要求',
    next_action: '出具含PLC自动化控制方案的技术报价单',
    next_action_due: '2026-06-20',
  },
  {
    id: uid('ci'),
    customer_id: 'cust_002',
    user_id: 'user_xiaodong',
    type: 'call',
    summary: '电话沟通需求，确认冷坩埚悬浮熔炼系统容量要求为50kg级别',
    next_action: '安排实验室参观和技术演示',
    next_action_due: '2026-06-18',
  },
  {
    id: uid('ci'),
    customer_id: 'cust_003',
    user_id: 'user_larry',
    type: 'visit',
    summary: '工厂考察，了解现有设备情况，对方旧炉已超期服役需立即更换',
    next_action: '报价后3天内跟进，对方有竞品在谈',
    next_action_due: '2026-06-15',
  },
]

const insertInteraction = db.prepare(`
  INSERT OR IGNORE INTO customer_interactions (id, customer_id, user_id, type, summary, next_action, next_action_due)
  VALUES (@id, @customer_id, @user_id, @type, @summary, @next_action, @next_action_due)
`)

for (const i of interactions) {
  insertInteraction.run(i)
}
console.log('  ✓ 客户互动记录')

// ── 商机（线索池）─────────────────────────────────────────────

const opportunities = [
  {
    id: 'opp_001',
    title: '某航空发动机研究院 镍基高温合金真空熔炼设备采购',
    source_platform: '中国政府采购网',
    source_url: 'https://www.ccgp.gov.cn/mock/001',
    org_name: '中国航发动力研究院',
    budget: '800万元',
    deadline: '2026-07-15',
    status: 'active',
    fetch_quality: 90,
    raw_content: '采购真空感应熔炼炉1台，要求：最大熔炼量≥200kg，真空度≤0.01Pa，具备自动浇注功能，提供完整售后培训。',
    keywords: '真空感应熔炼,高温合金,镍基,航空发动机',
  },
  {
    id: 'opp_002',
    title: '国家重点实验室 冷坩埚悬浮熔炼系统采购项目',
    source_platform: '科技部采购平台',
    source_url: 'https://service.most.gov.cn/mock/002',
    org_name: '中科院物理研究所',
    budget: '450万元',
    deadline: '2026-06-30',
    status: 'active',
    fetch_quality: 85,
    raw_content: '拟采购冷坩埚感应悬浮熔炼系统一套，用于高熵合金和难熔金属研究，要求无坩埚污染，悬浮稳定，具备高速摄像接口。',
    keywords: '冷坩埚,悬浮熔炼,高熵合金,难熔金属',
  },
  {
    id: 'opp_003',
    title: '某省级稀贵金属产业园区 真空冶炼设备集采',
    source_platform: '省级政采云',
    source_url: 'https://zcy.gov.cn/mock/003',
    org_name: '江西稀贵金属产业集团',
    budget: '1200万元',
    deadline: '2026-08-01',
    status: 'active',
    fetch_quality: 75,
    raw_content: '园区建设需求，采购真空冶炼设备共5台套，包含：真空感应炉×2、真空自耗炉×2、电子束炉×1，要求统一售后服务。',
    keywords: '真空冶炼,稀贵金属,真空自耗炉,电子束炉',
  },
  {
    id: 'opp_004',
    title: '高校实验室 小型真空电弧熔炼炉采购',
    source_platform: '教育部采购网',
    source_url: 'https://edu.ccgp.gov.cn/mock/004',
    org_name: '哈尔滨工业大学',
    budget: '60万元',
    deadline: '2026-06-25',
    status: 'active',
    fetch_quality: 70,
    raw_content: '材料学院科研用，采购小型真空电弧熔炼炉1台，容量≥50g，具备翻转熔炼功能，配吸铸模具。',
    keywords: '真空电弧熔炼,高校,科研,小型',
  },
  {
    id: 'opp_005',
    title: '新能源汽车关键材料研究项目 真空熔炼设备',
    source_platform: '工信部采购',
    source_url: 'https://miit.gov.cn/mock/005',
    org_name: '比亚迪研究院',
    budget: '300万元',
    deadline: '2026-07-30',
    status: 'active',
    fetch_quality: 80,
    raw_content: '新能源汽车永磁材料和铜合金研究，采购中型真空感应熔炼炉，要求50kg级，配套真空热处理功能，需提供工艺方案。',
    keywords: '新能源,永磁材料,铜合金,真空感应',
  },
]

const insertOpportunity = db.prepare(`
  INSERT OR REPLACE INTO opportunities
    (id, title, source_platform, source_url, org_name, budget, deadline, status, fetch_quality, raw_content, keywords, crawled_at)
  VALUES
    (@id, @title, @source_platform, @source_url, @org_name, @budget, @deadline, @status, @fetch_quality, @raw_content, @keywords, datetime('now'))
`)

for (const o of opportunities) {
  insertOpportunity.run(o)
  console.log(`  ✓ 商机  ${o.title.slice(0, 30)}...`)
}

// ── 商机评分（部分同事已评） ───────────────────────────────────

const ratings = [
  { id: uid('r'), opportunity_id: 'opp_001', user_id: 'user_larry', score: 80, note: '完全匹配我们VIM-200，航空院采购流程规范，值得重点跟进' },
  { id: uid('r'), opportunity_id: 'opp_001', user_id: 'user_gu',    score: 80, note: '技术要求我们都能满足' },
  { id: uid('r'), opportunity_id: 'opp_002', user_id: 'user_larry', score: 60, note: '冷坩埚是我们强项，但450万预算偏低，成本压力大' },
  { id: uid('r'), opportunity_id: 'opp_003', user_id: 'user_xiaodong', score: 30, note: '体量大但要求电子束炉，这个我们没有，需要外协' },
  { id: uid('r'), opportunity_id: 'opp_005', user_id: 'user_larry', score: 60, note: '新能源赛道新客户，值得开拓' },
]

const insertRating = db.prepare(`
  INSERT OR IGNORE INTO opportunity_ratings (id, opportunity_id, user_id, score, note)
  VALUES (@id, @opportunity_id, @user_id, @score, @note)
`)

for (const r of ratings) insertRating.run(r)
console.log('  ✓ 商机评分')

// ── 任务 ───────────────────────────────────────────────────────

const tasks = [
  {
    id: uid('task'),
    title: '给北京航材院出具VIM-200含自动化控制的完整报价单',
    assignee_id: 'user_larry',
    creator_id: 'user_jamie',
    status: 'in_progress',
    priority: 'high',
    due_date: '2026-06-20',
    customer_id: 'cust_001',
    opportunity_id: null,
  },
  {
    id: uid('task'),
    title: '安排西北有色金属研究院来厂参观和冷坩埚技术演示',
    assignee_id: 'user_xiaodong',
    creator_id: 'user_jamie',
    status: 'todo',
    priority: 'high',
    due_date: '2026-06-18',
    customer_id: 'cust_002',
    opportunity_id: null,
  },
  {
    id: uid('task'),
    title: '跟进龙腾特种合金报价，防止竞品截单',
    assignee_id: 'user_larry',
    creator_id: 'user_larry',
    status: 'todo',
    priority: 'high',
    due_date: '2026-06-15',
    customer_id: 'cust_003',
    opportunity_id: null,
  },
  {
    id: uid('task'),
    title: '准备哈工大小型真空电弧炉投标文件',
    assignee_id: 'user_zhiping',
    creator_id: 'user_jamie',
    status: 'todo',
    priority: 'normal',
    due_date: '2026-06-22',
    customer_id: null,
    opportunity_id: 'opp_004',
  },
  {
    id: uid('task'),
    title: '研究航发动力研究院采购需求，制定技术应标方案',
    assignee_id: 'user_gu',
    creator_id: 'user_jamie',
    status: 'todo',
    priority: 'high',
    due_date: '2026-07-01',
    customer_id: null,
    opportunity_id: 'opp_001',
  },
  {
    id: uid('task'),
    title: '整理真空悬浮熔炼技术白皮书，用于新加坡客户推介',
    assignee_id: 'user_luyang',
    creator_id: 'user_jamie',
    status: 'in_progress',
    priority: 'normal',
    due_date: '2026-06-30',
    customer_id: 'cust_005',
    opportunity_id: null,
  },
]

const insertTask = db.prepare(`
  INSERT OR IGNORE INTO tasks
    (id, title, assignee_id, creator_id, status, priority, due_date, customer_id, opportunity_id, source_type)
  VALUES
    (@id, @title, @assignee_id, @creator_id, @status, @priority, @due_date, @customer_id, @opportunity_id, 'manual')
`)

for (const t of tasks) {
  insertTask.run(t)
  console.log(`  ✓ 任务  ${t.title.slice(0, 35)}...`)
}

// ── 广播通知 ───────────────────────────────────────────────────

db.prepare(`
  INSERT OR IGNORE INTO broadcasts (id, title, content, creator_id, target_user_ids)
  VALUES (?, ?, ?, ?, ?)
`).run(
  'bc_001',
  '本周重点商机：航发院800万采购，请各自评分',
  '航发动力研究院发布真空熔炼设备招标，预算800万，截止7月15日。请大家在线索池里评分，重点说明技术匹配度和竞争风险。Jamie 将在本周五汇总后决定是否全力投标。',
  'user_jamie',
  JSON.stringify(['user_larry', 'user_gu', 'user_xiaodong', 'user_zhiping'])
)
console.log('  ✓ 广播通知')

db.close()
console.log('\n✅ 演示数据注入完成！\n')
console.log('  客户数：', customers.length)
console.log('  商机数：', opportunities.length)
console.log('  任务数：', tasks.length)
console.log('\n重启 server 后即可看到数据。\n')
