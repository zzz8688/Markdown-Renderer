/**
  * remark 指令语法处理插件
  *
  * 解析来自 remark-directive 的三类节点：
  * - textDirective   行内指令 :badge[TXT]{type="success"}
  * - leafDirective   叶子指令
  * - containerDirective 容器指令 :::callout[type=note] ... :::
  *
  * 本插件将这些指令节点映射为对应的 HAST 元素（通过 data.hName / data.hProperties）， 
  * 以便后续 remark-rehype 在生成 HTML 时正确输出。
  */
import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * 生成器：返回一个对 MDAST 的转换函数
 */
const remarkDirectivesPlugin: Plugin<[], Root> = () => {
  return (tree) => {
    // 遍历MDAST整棵树，寻找三类指令节点
    visit(tree, (node: any) => {
      //只对MDAST的三类指令节点进行处理
      if (
        node.type === 'textDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'containerDirective'
      ) {
        const data = node.data || (node.data = {})

        if (node.name === 'badge') {
          // :badge 指令 -> <span class="md-badge md-badge-{type}">...</span>
          const type = node.attributes?.type || 'default'
          data.hName = 'span'
          data.hProperties = {
            className: ['md-badge', `md-badge-${type}`],
          }
        }

        if (node.name === 'callout') {
          // :::callout 指令 -> <div class="md-callout md-callout-{type}">...</div>
          const type = node.attributes?.type || 'note'
          data.hName = 'div'
          data.hProperties = {
            className: ['md-callout', `md-callout-${type}`],
          }
        }
      }
    })
  }
}

export default remarkDirectivesPlugin
