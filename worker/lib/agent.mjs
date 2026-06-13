/**
 * Agent 上下文协议
 *
 * 四级上下文：
 *   Level 0 — 纯净：仅用户姓名 + 角色（新对话默认）
 *   Level 1 — 轻量：+ 近期任务 + 跟进中客户（2轮后）
 *   Level 2 — 精准：+ 单一实体完整信息（意图检测）
 *   Level 3 — 完整：+ 客户+任务+方案+商机（用户明确触发）
 */

const STAGE_LABELS = {
  untouched: '未接触',
  contacted: '已接触',
  interested: '有意向',
  quoting: '待报价',
  closing: '待成交',
  won: '已成交',
  lost: '已流失',
}

const TASK_STATUS_LABELS = {
  todo: '待办',
  in_progress: '进行中',
  waiting: '等待反馈',
  done: '已完成',
  closed: '已关闭',
}

// 意图检测（前端同步一份，后端权威版本）
const INTENT_PATTERNS = {
  customer: /客户|合同|拜访|跟进|联系|谈判|合作|甲方|业主/,
  task: /任务|截止|完成|负责|分配|进度|交付|跟进/,
  opportunity: /招标|商机|线索|投标|项目采购|标书/,
  proposal: /方案|报价|设备参数|成本|风险|配置|型号|规格/,
  knowledge: /经验|复盘|上次|之前|历史案例|同类项目/,
}

export function detectContextLevel(messages) {
  if (!messages || messages.length < 2) return 0
  const recentText = messages.slice(-4).map(m => m.content).join(' ')
  const hits = Object.values(INTENT_PATTERNS).filter(p => p.test(recentText)).length
  if (hits === 0) return 1
  if (hits === 1) return 2
  return 3
}

export function detectIntentSignals(text) {
  const signals = {}
  for (const [key, pattern] of Object.entries(INTENT_PATTERNS)) {
    signals[key] = pattern.test(text)
  }
  return signals
}

/**
 * 构建系统 prompt（按上下文级别）
 */
export async function buildSystemPrompt({ user, contextLevel, db, entityRef }) {
  const lines = []

  // ── 基础层（始终存在）──────────────────────────────────────
  lines.push(`你是 ${user.display_name} 的工作助理 ${user.display_name}_AI。`)
  lines.push(`你们公司专注于真空熔炼、高温难熔金属设备的研发与销售，核心产品包括真空感应熔炼炉、冷坩埚悬浮熔炼系统、高熵合金制备设备及相关服务。`)
  lines.push(``)
  lines.push(`【核心原则】`)
  lines.push(`- 先充分回答问题，再提示可选的下一步动作`)
  lines.push(`- 不要主动引入业务流程，除非用户明确需要`)
  lines.push(`- 回答要直接、具体，不要空话套话`)
  lines.push(`- 遇到不确定的技术参数，明确说明需要确认，不要编造`)

  // ── Level 1：轻量上下文 ────────────────────────────────────
  if (contextLevel >= 1) {
    const tasks = await db.prepare(
      `SELECT title, status, due_date FROM tasks
       WHERE assignee_id = ? AND status NOT IN ('done','closed')
       ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, due_date ASC
       LIMIT 4`
    ).bind(user.id).all()

    if (tasks.results.length > 0) {
      lines.push(`\n【你当前的待办任务】`)
      for (const t of tasks.results) {
        const due = t.due_date ? `截止 ${t.due_date}` : '无截止时间'
        lines.push(`- ${t.title}（${TASK_STATUS_LABELS[t.status] || t.status}，${due}）`)
      }
    }

    const customers = await db.prepare(
      `SELECT name, stage, last_interaction_at FROM customers
       WHERE owner_id = ? AND stage NOT IN ('won','lost')
       ORDER BY last_interaction_at ASC NULLS FIRST
       LIMIT 3`
    ).bind(user.id).all()

    if (customers.results.length > 0) {
      lines.push(`\n【你负责跟进的客户】`)
      for (const c of customers.results) {
        const lastContact = c.last_interaction_at
          ? `最近联系 ${c.last_interaction_at.slice(0, 10)}`
          : '尚无联系记录'
        lines.push(`- ${c.name}（${STAGE_LABELS[c.stage] || c.stage}，${lastContact}）`)
      }
    }
  }

  // ── Level 2：精准上下文 ────────────────────────────────────
  if (contextLevel >= 2 && entityRef) {
    if (entityRef.type === 'customer' && entityRef.id) {
      const c = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(entityRef.id).first()
      if (c) {
        lines.push(`\n【当前客户详情：${c.name}】`)
        lines.push(`- 阶段：${STAGE_LABELS[c.stage] || c.stage}`)
        lines.push(`- 负责人：${user.display_name}`)
        if (c.contact_name) lines.push(`- 联系人：${c.contact_name}${c.contact_phone ? '  ' + c.contact_phone : ''}`)
        if (c.industry) lines.push(`- 行业：${c.industry}`)
        if (c.notes) lines.push(`- 备注：${c.notes}`)

        const interactions = await db.prepare(
          `SELECT type, summary, next_action, created_at FROM customer_interactions
           WHERE customer_id = ? ORDER BY created_at DESC LIMIT 3`
        ).bind(c.id).all()

        if (interactions.results.length > 0) {
          lines.push(`- 最近沟通：`)
          for (const i of interactions.results) {
            lines.push(`  · ${i.created_at.slice(0, 10)} ${i.summary}`)
            if (i.next_action) lines.push(`    下一步：${i.next_action}`)
          }
        }
      }
    }

    if (entityRef.type === 'opportunity' && entityRef.id) {
      const o = await db.prepare('SELECT * FROM opportunities WHERE id = ?').bind(entityRef.id).first()
      if (o) {
        lines.push(`\n【当前商机详情：${o.title}】`)
        if (o.org_name) lines.push(`- 招标单位：${o.org_name}`)
        if (o.budget) lines.push(`- 预算：${o.budget}`)
        if (o.deadline) lines.push(`- 截止日期：${o.deadline}`)
        if (o.raw_content) lines.push(`- 内容摘要：${o.raw_content.slice(0, 500)}`)
      }
    }
  }

  // ── Level 3：完整上下文 ────────────────────────────────────
  if (contextLevel >= 3) {
    // 相关方案
    if (entityRef?.customerId) {
      const proposals = await db.prepare(
        `SELECT title, status, price_range_min, price_range_max FROM proposals
         WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 2`
      ).bind(entityRef.customerId).all()
      if (proposals.results.length > 0) {
        lines.push(`\n【相关方案/报价】`)
        for (const p of proposals.results) {
          const range = p.price_range_min ? `${p.price_range_min}~${p.price_range_max} 万元` : '待定'
          lines.push(`- ${p.title}（${p.status}，${range}）`)
        }
      }
    }

    // 最近知识条目
    const knowledge = await db.prepare(
      `SELECT title, content FROM knowledge_items
       WHERE visibility IN ('team','public') AND is_published = 1
       ORDER BY updated_at DESC LIMIT 3`
    ).all()
    if (knowledge.results.length > 0) {
      lines.push(`\n【团队经验参考】`)
      for (const k of knowledge.results) {
        lines.push(`- ${k.title}：${k.content.slice(0, 200)}`)
      }
    }
  }

  // ── 能力提示（始终存在）───────────────────────────────────
  lines.push(`\n【你可以做的事（在用户明确需要时提示）】`)
  lines.push(`- 帮用户整理下一步行动并建议创建任务`)
  lines.push(`- 根据对话内容更新客户跟进状态`)
  lines.push(`- 从对话中提炼知识沉淀到团队经验库`)
  lines.push(`- 调用方案工程师 Agent 生成技术方案（需要用户确认）`)

  return lines.join('\n')
}

/**
 * 从 AI 回复中提取结构化动作建议
 * 格式：[[ACTION:type:label]] 或自然语言解析
 */
export function extractActions(content) {
  const actions = []
  const matches = content.matchAll(/\[\[ACTION:(\w+):([^\]]+)\]\]/g)
  for (const m of matches) {
    actions.push({ type: m[1], label: m[2] })
  }
  return actions
}
