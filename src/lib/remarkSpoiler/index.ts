/**
 * remarkSpoiler 插件
 *
 * 负责把行内的 `!!! 文本 !!!` 转换为
 * <span class="md-spoiler">文本</span>，
 * 再由 CSS 控制 hover 前后是否可见。
 */
import type { Plugin } from 'unified';
import type { Root, Text, Content } from 'mdast';
import { visit } from 'unist-util-visit';

const SPOILER_REGEX = /!!!([\s\S]+?)!!!/g;

const remarkSpoiler: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || typeof index !== 'number') return;

      const value = node.value;
      let match: RegExpExecArray | null;
      let lastIndex = 0;
      const newChildren: Content[] = [];

      while ((match = SPOILER_REGEX.exec(value)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;

        // 追加前面的普通文本
        if (matchStart > lastIndex) {
          newChildren.push({
            type: 'text',
            value: value.slice(lastIndex, matchStart),
          } as Text);
        }

        const innerText = match[1];

        // 追加 spoiler 节点
        newChildren.push({
          type: 'spoiler' as any,
          children: [
            {
              type: 'text',
              value: innerText,
            } as Text,
          ],
          data: {
            hName: 'span',
            hProperties: {
              className: ['md-spoiler'],
            },
          },
        } as any);

        lastIndex = matchEnd;
      }

      // 没有匹配到任何 !!!...!!!，保持原样
      if (!newChildren.length) return;

      // 追加剩余的普通文本
      if (lastIndex < value.length) {
        newChildren.push({
          type: 'text',
          value: value.slice(lastIndex),
        } as Text);
      }

      parent.children.splice(index, 1, ...newChildren);
    });
  };
};

export default remarkSpoiler;
