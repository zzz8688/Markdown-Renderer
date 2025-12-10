/**
 * Markdown 渲染管线
 *
 * 使用 unified 体系将 Markdown 文本转换为 HTML：
 * - remark-parse 解析 Markdown 为 MDAST
 * - remark-gfm 支持 GFM 扩展（表格、任务列表等）
 * - remark-math 支持行内/块级数学公式
 * - remark-directive + 自定义插件，解析指令语法（如 :badge、:::callout）
 * - remark-rehype 将 MDAST 转换为 HAST（HTML AST）
 * - rehype-katex 渲染数学公式为 KaTeX HTML
 * - rehype-stringify 将 HAST 序列化为字符串 HTML
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import remarkDirective from 'remark-directive'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkDirectivesPlugin from './remark-directives'
import remarkSpoiler from './remarkSpoiler'
import { renderCache, hashString, cacheStats } from './lruCache'

/**
 * 将 Markdown 文本渲染为 HTML。
 * @param markdown 原始 Markdown 字符串
 * @returns 渲染后的 HTML 字符串
 */

// 预编译的 unified 处理器，避免每次渲染都重新构建管线
const processor = unified()
  // 1. 解析 Markdown 为语法树
  .use(remarkParse)
  // 2. 支持 GitHub Flavored Markdown（表格、删除线等）
  .use(remarkGfm)
  // 3. 支持数学公式（LaTeX）
  .use(remarkMath)
  // 4-5. 支持自定义指令和指令插件
  .use(remarkDirective)
  .use(remarkDirectivesPlugin)
  // 6. 自定义剧透（Spoiler）语法
  .use(remarkSpoiler)
  // 7. 将 Markdown 语法树转换为 HTML 语法树
  .use(remarkRehype)
  // 8. 使用 KaTeX 渲染数学公式
  .use(rehypeKatex)
  // 9. 将 HAST 序列化为 HTML 字符串
  .use(rehypeStringify)

/**
 * 将 Markdown 文本渲染为 HTML（带 LRU 缓存）
 * @param markdown 原始 Markdown 字符串
 * @returns 渲染后的 HTML 字符串
 */
// renderMarkdown执行流程：worker或者主线程都会调用renderMarkdown，包含LRU缓存
export async function renderMarkdown(markdown: string): Promise<string> {
  // 生成缓存 key
  const cacheKey = hashString(markdown)
  
  // 检查缓存是否存在，如果存在直接返回已有HTML
  const cached = renderCache.get(cacheKey)
  if (cached !== undefined) {
    cacheStats.hits++
    return cached
  }
  cacheStats.misses++
  
  // 使用预编译的处理器渲染
  const file = await processor
  .process(markdown)
  
  const result = String(file)
  
  // 存入缓存
  renderCache.set(cacheKey, result)
  
  return result
}
