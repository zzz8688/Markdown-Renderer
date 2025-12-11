/**
 * remarkSpoiler 插件
 *
 * 作用：在 MDAST 抽象语法树中把行内的 `!!! 文本 !!!` 识别出来，
 *       把其中的“文本”替换成自定义的 spoiler 节点，并最终渲染为
 *       `<span class="md-spoiler">文本</span>`。
 *
 * 可见性由 playground.css 中的 `.md-spoiler` 样式控制：
 * - 默认用黑底 + 透明文字遮住内容
 * - 鼠标 hover 时去掉遮挡并显示真实文本
 */
import type { Plugin } from 'unified'
import type { Root, Text, Content } from 'mdast'
import { visit, SKIP } from 'unist-util-visit'

// 使用非贪婪匹配，捕获 !!! 与 !!! 之间的任意内容（包括换行）
// 例如："这是 !!!被剧透!!! 的一段话" 中的 "被剧透" 会被提取出来
// 全局正则用于在单个文本节点中多次匹配；注意每次使用前需重置 lastIndex
// //：正则表达式的开始和结束分隔符
// !!!：字面匹配字符 "!!!"
// ([\s\S]+?)：核心匹配部分
// !!!：字面匹配字符 "!!!"
// g：全局匹配标志

const SPOILER_REGEX = /!!!([\s\S]+?)!!!/g

const remarkSpoiler: Plugin<[], Root> = () => {
  return (tree) => {
    // 只在文本节点（type = 'text'）里查找 !!!...!!!
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return

      const value = node.value
      // 快速拒绝：没有标记则不处理，减少正则开销
      if (value.indexOf('!!!') === -1) return

      // 重置全局正则的游标，避免跨节点复用造成遗漏
      SPOILER_REGEX.lastIndex = 0

      let match: RegExpExecArray | null
      let lastIndex = 0
      const newChildren: Content[] = [] // 替换当前 text 节点的片段列表

      // 依次匹配当前文本中的所有 !!!...!!! 片段
      while ((match = SPOILER_REGEX.exec(value)) !== null) {
        const matchStart = match.index
        const matchEnd = match.index + match[0].length

        // 1) 追加当前匹配前面的普通文本片段
        if (matchStart > lastIndex) {
          newChildren.push({ type: 'text', value: value.slice(lastIndex, matchStart) } as Text)
        }

        // 2) 追加 spoiler 片段 -> <span class="md-spoiler">...</span>
        const innerText = match[1]
        newChildren.push({
          type: 'spoiler' as any,
          children: [{ type: 'text', value: innerText } as Text],
          data: { hName: 'span', hProperties: { className: ['md-spoiler'] } },
        } as any)

        lastIndex = matchEnd
      }

      // 没有匹配到任何 !!!...!!!，保持原样
      if (!newChildren.length) return

      // 追加最后一次匹配之后的普通文本
      if (lastIndex < value.length) {
        newChildren.push({ type: 'text', value: value.slice(lastIndex) } as Text)
      }

      // 用新片段替换原来的单个 text 节点
      parent.children.splice(index, 1, ...newChildren)
      // 跳过新插入节点的递归访问，继续从插入段落后的位置遍历
      return [SKIP, index + newChildren.length] as any
    })
  }
};

export default remarkSpoiler;
