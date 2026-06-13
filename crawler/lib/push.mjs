/**
 * 推送爬虫结果到 BusinessOS API
 */

/**
 * 向 /api/crawler/opportunities 推送一条线索
 * @param {object} opportunity - mapToOpportunity() 的返回值
 * @param {string} apiBase - e.g. https://businessos.giantmedal.com
 * @param {string} crawlerKey - CRAWLER_SECRET
 * @returns {Promise<{ok: boolean, id?: number, error?: string}>}
 */
export async function pushOpportunity(opportunity, apiBase, crawlerKey) {
  try {
    const res = await fetch(`${apiBase}/api/crawler/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Crawler-Key': crawlerKey,
      },
      body: JSON.stringify(opportunity),
    })

    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = await res.json()
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * 检查 URL 是否已经处理过（防止重复推送）
 * @param {string} sourceUrl
 * @param {string} apiBase
 * @param {string} crawlerKey
 * @returns {Promise<boolean>}
 */
export async function checkUrlExists(sourceUrl, apiBase, crawlerKey) {
  try {
    const encoded = encodeURIComponent(sourceUrl)
    const res = await fetch(`${apiBase}/api/crawler/check?url=${encoded}`, {
      headers: { 'X-Crawler-Key': crawlerKey },
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.exists === true
  } catch {
    return false
  }
}
