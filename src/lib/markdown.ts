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

/**
 * 将 Markdown 文本渲染为 HTML。
 * @param markdown 原始 Markdown 字符串
 * @returns 渲染后的 HTML 字符串
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkDirectivesPlugin)
    // 自定义行内 Spoiler 语法：!!! 文本 !!!
    .use(remarkSpoiler)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown)
  const result = String(file)
  return result
}
