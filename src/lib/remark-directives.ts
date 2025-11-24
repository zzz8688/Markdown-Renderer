import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const remarkDirectivesPlugin: Plugin<[], Root> = () => {
  return (tree) => {
    console.log('Directive plugin running, tree:', tree)
    let directiveCount = 0
    
    // 先检查是否有任何指令节点
    visit(tree, (node: any) => {
      if (node.type === 'textDirective' || node.type === 'leafDirective' || node.type === 'containerDirective') {
        directiveCount++
        console.log(`Found directive: ${node.name}`, node)
        
        const data = node.data || (node.data = {})

        if (node.name === 'badge') {
          const type = node.attributes?.type || 'default'
          data.hName = 'span'
          data.hProperties = {
            className: ['md-badge', `md-badge-${type}`],
          }
        }

        if (node.name === 'callout') {
          const type = node.attributes?.type || 'note'
          data.hName = 'div'
          data.hProperties = {
            className: ['md-callout', `md-callout-${type}`],
          }
        }
      }
    })
    
    console.log(`Total directives found: ${directiveCount}`)
    
    // 如果没有找到指令，检查原始文本中是否包含指令语法
    if (directiveCount === 0) {
      visit(tree, 'text', (node: any) => {
        if (node.value && (node.value.includes(':badge') || node.value.includes(':::callout'))) {
          console.log('Found directive syntax in text node:', node.value)
        }
      })
    }
  }
}

export default remarkDirectivesPlugin
