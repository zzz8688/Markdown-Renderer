import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import remarkDirective from 'remark-directive'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import remarkDirectivesPlugin from './remark-directives'

export async function renderMarkdown(markdown: string): Promise<string> {
  console.log('Input markdown:', markdown)
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkDirectivesPlugin)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(markdown)
  const result = String(file)
  console.log('Output HTML:', result)
  return result
}
