import { describe, it, expect } from 'vitest'
import { htmlToText, extractLinks } from './http.mjs'

describe('htmlToText', () => {
  it('去除 script/style 与标签，保留正文', () => {
    const html = '<style>.a{}</style><script>var x=1</script><p>你好 <b>世界</b></p>'
    const out = htmlToText(html)
    expect(out).toContain('你好')
    expect(out).toContain('世界')
    expect(out).not.toContain('var x')
    expect(out).not.toMatch(/<[^>]+>/)
  })

  it('解码常见 HTML 实体', () => {
    expect(htmlToText('<p>A&amp;B &lt;tag&gt; &quot;q&quot;</p>')).toContain('A&B <tag> "q"')
  })

  it('空输入返回空串', () => {
    expect(htmlToText('')).toBe('')
    expect(htmlToText(null)).toBe('')
  })

  it('输出截断到 6000 字符以内', () => {
    const big = '<p>' + 'a'.repeat(10000) + '</p>'
    expect(htmlToText(big).length).toBeLessThanOrEqual(6000)
  })
})

describe('extractLinks', () => {
  it('解析相对链接为绝对地址并去重', () => {
    const html = `
      <a href="/notice/1">采购公告一二三</a>
      <a href="/notice/1">采购公告一二三</a>
      <a href="https://other.com/x">外部公告链接示例</a>
      <a href="#">忽略锚点</a>
      <a href="javascript:void(0)">忽略脚本</a>
    `
    const links = extractLinks(html, 'https://base.gov.cn/list')
    const hrefs = links.map(l => l.href)
    expect(hrefs).toContain('https://base.gov.cn/notice/1')
    expect(hrefs).toContain('https://other.com/x')
    // 去重：/notice/1 只出现一次
    expect(hrefs.filter(h => h.endsWith('/notice/1')).length).toBe(1)
    // 锚点/JS 链接被过滤
    expect(hrefs.some(h => h.includes('javascript'))).toBe(false)
  })
})
