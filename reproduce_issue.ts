
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

async function render(markdown: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown)
  return String(file)
}

async function main() {
  const input = "```js\nconsole.log('hello')"
  
  console.log('--- Input ---')
  console.log(input)
  
  const output = await render(input)
  console.log('\n--- Output (Implicit Close) ---')
  console.log(output)

  const inputClosed = input + "\n```"
  const outputClosed = await render(inputClosed)
  console.log('\n--- Output (Explicit Close) ---')
  console.log(outputClosed)

  console.log('\n--- Comparison ---')
  console.log('Identical?', output === outputClosed)
}

main()
