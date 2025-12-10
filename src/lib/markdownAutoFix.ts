//补全范围：table 语法、代码块语法、行内代码语法、$$ 公式语法、链接语法、图片语法
// 自动补全配置项：目前只有一个开关，后续可扩展更多策略
export interface MarkdownAutoFixOptions {
  enable: boolean
}

const CODE_FENCE = '```'

// 统计 text 中 token 出现次数的简单工具函数
function countOccurrences(text: string, token: string): number {
  return text.split(token).length - 1
}

// 自动补齐未闭合的 ``` 代码块：在末尾补上一行 ```
function fixUnclosedCodeFence(text: string): string {
  if (countOccurrences(text, CODE_FENCE) % 2 === 1) {
    return text + '\n```'
  }
  return text
}

// 当关闭自动修复时，保护性地“拆掉”最后一个 ```，避免后文全被当成代码块
function guardUnclosedCodeFence(text: string): string {
  if (countOccurrences(text, CODE_FENCE) % 2 === 1) {
    const i = text.lastIndexOf(CODE_FENCE)
    if (i !== -1) {
      return text.slice(0, i) + '``\u200B`' + text.slice(i + CODE_FENCE.length)
    }
  }
  return text
}

// 从后往前找到最后一个非空行的下标，找不到则返回 -1
function getLastNonEmptyLineIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') return i
  }
  return -1
}

// 修复未闭合的 $$ 数学块：若 $$ 次数为奇数，则在末尾补一个 $$
function fixUnclosedMathBlock(text: string): string {
  const count = text.split('$$').length - 1
  if (count % 2 === 1) {
    return text + '\n$$'
  }
  return text
}
//当关闭自动修复时，保护性地“拆掉”最后一个 $$，避免后文全被当成数学块
function guardUnclosedMathBlock(text: string): string {
  const total = countOccurrences(text, '$$')
  if (total % 2 === 1) {
    const i = text.lastIndexOf('$$')
    if (i !== -1) {
      return text.slice(0, i) + '$\u200B$' + text.slice(i + 2)
    }
    return text
  }
  // 计数已平衡时，去除之前的保护性零宽字符，恢复为正常 $$
  if (text.indexOf('$\u200B$') !== -1) {
    return text.replace(/\$\u200B\$/g, '$$')
  }
  return text
}

function isInsideCodeFence(lines: string[], idx: number): boolean {
  let cnt = 0
  for (let i = 0; i <= idx; i++) {
    cnt += countOccurrences(lines[i], CODE_FENCE)
  }
  return cnt % 2 === 1
}

function isInsideMathBlock(lines: string[], idx: number): boolean {
  let cnt = 0
  for (let i = 0; i <= idx; i++) {
    cnt += countOccurrences(lines[i], '$$')
  }
  return cnt % 2 === 1
}

// 针对最后一个非空行，若行内反引号数量为奇数，则在该行末尾补一个 `
function fixInlineCode(text: string): string {
  const lines = text.split('\n')
  const idx = getLastNonEmptyLineIndex(lines)
  if (idx === -1) return text
  const line = lines[idx]
  const withoutFences = line.replace(/```+/g, '')
  const ticks = withoutFences.match(/`/g)
  if (ticks && ticks.length % 2 === 1) {
    lines[idx] = line + '`'
    return lines.join('\n')
  }
  return text
}

function guardTableStreaming(text: string): string {
  const lines = text.split('\n')
  const idx = getLastNonEmptyLineIndex(lines)
  if (idx === -1) return text
  if (isInsideCodeFence(lines, idx)) return text
  const line = lines[idx]
  const sepRe = /^\s*\|?\s*:?-{3,}:?(?:\s*\|\s*:?-{3,}:?)*\s*\|?\s*$/

  const prevIdx = (() => {
    for (let j = idx - 1; j >= 0; j--) {
      if (lines[j].trim() !== '') return j
    }
    return -1
  })()

  const isSeparator = sepRe.test(line)
  const pipeCount = (line.match(/\|/g) || []).length
  const trimmedEnd = line.replace(/\s+$/, '')
  const looksCompleteRow = pipeCount >= 2 && trimmedEnd.endsWith('|')

  // 案例：有分隔行，且当前是一行完整数据 -> 解除 header 与分隔行的保护（兼容移除旧的零宽防护）
  const prevIsSep = prevIdx >= 0 && sepRe.test(lines[prevIdx].replace(/\\-/g, '-'))
  if (looksCompleteRow && prevIsSep) {
    // 解除 header（再往上找一行非空即 header）
    for (let j = prevIdx - 1; j >= 0; j--) {
      if (lines[j].trim() === '') continue
      lines[j] = lines[j]
        .replace(/\\\|/g, '|')
        .replace(/\|\u200B/g, '|')
      break
    }
    // 解除分隔行保护
    lines[prevIdx] = lines[prevIdx]
      .replace(/\\-/g, '-')
      .replace(/-\u200B/g, '-')
    // 解除当前行可能已有的保护
    lines[idx] = lines[idx]
      .replace(/\\\|/g, '|')
      .replace(/\|\u200B/g, '|')
    return lines.join('\n')
  }

  // 当前行为分隔行：对分隔行自身加保护，并确保上方 header 被保护
  if (isSeparator) {
    const k = line.indexOf('-')
    if (k !== -1 && line[k - 1] !== '\\') {
      lines[idx] = line.slice(0, k) + '\\-' + line.slice(k)
    }
    if (prevIdx >= 0) {
      const header = lines[prevIdx]
      // 保护 header：转义第一个未转义管道
      let h = header
      for (let i = 0; i < h.length; i++) {
        if (h[i] === '|' && h[i - 1] !== '\\') {
          h = h.slice(0, i) + '\\|' + h.slice(i + 1)
          break
        }
      }
      lines[prevIdx] = h
    }
    return lines.join('\n')
  }

  // 一般情况：若当前行包含管道但尚未满足“形成表格”的条件，则对当前行加保护（转义第一个未转义管道）
  let firstPipe = -1
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|' && line[i - 1] !== '\\') { firstPipe = i; break }
  }
  if (firstPipe !== -1) {
    const headerReady = looksCompleteRow && prevIsSep
    if (!headerReady) {
      lines[idx] = line.slice(0, firstPipe) + '\\|' + line.slice(firstPipe + 1)
      return lines.join('\n')
    }
  }
  return text
}

function fixInlineMath(text: string): string {
  const lines = text.split('\n')
  const idx = getLastNonEmptyLineIndex(lines)
  if (idx === -1) return text

  if (isInsideCodeFence(lines, idx) || isInsideMathBlock(lines, idx)) {
    return text
  }

  const line = lines[idx]
  let singleDollarCount = 0

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch !== '$') continue

    const prev = i > 0 ? line[i - 1] : ''
    const next = i + 1 < line.length ? line[i + 1] : ''

    if (prev === '\\') continue

    if (next === '$') {
      i++
      continue
    }
    if (prev === '$') continue

    singleDollarCount++
  }

  if (singleDollarCount % 2 === 1) {
    lines[idx] = line + '$'
    return lines.join('\n')
  }
  return text
}

// 针对最后一个非空行，若看起来是一行表格但末尾缺少 |，则补上一个 | 以稳定表格结构
function fixTableSyntax(text: string): string {
  const lines = text.split('\n')
  const idx = getLastNonEmptyLineIndex(lines)
  if (idx === -1) return text
  const line = lines[idx]
  if (!line.trimStart().startsWith('|')) return text
  const pipeCount = (line.match(/\|/g) || []).length
  if (pipeCount < 2) return text
  const trimmedEnd = line.replace(/\s+$/, '')
  if (trimmedEnd.endsWith('|')) return text
  lines[idx] = trimmedEnd + ' |'
  return lines.join('\n')
}

// 在最后一个非空行上，尝试为未闭合的图片/链接语法补上右括号 )
function fixLinksAndImages(text: string): string {
  const lines = text.split('\n')
  const idx = getLastNonEmptyLineIndex(lines)
  if (idx === -1) return text
  const line = lines[idx]
  let newLine = line
  if (/!\[[^\]]*]\([^\)\n]*$/.test(line)) {
    newLine = line + ')'
  } else if (/\[[^\]]*]\([^\)\n]*$/.test(line)) {
    newLine = line + ')'
  } else {
    return text
  }
  lines[idx] = newLine
  return lines.join('\n')
}

// 入口函数：根据开关决定是否启用自动补齐逻辑
// - 代码块 fence 未闭合时，无论开关状态都会被处理：
//   - enable=true  自动补齐 ```
//   - enable=false 仅做保护性“拆分”避免吃掉后文
// - 公式 / 表格 / 行内代码 / 链接 / 图片 等修复仅在 enable=true 时生效
export function applyMarkdownAutoFix(markdown: string, options: MarkdownAutoFixOptions): string {
  const { enable } = options
  let text = markdown

  const fenceCount = countOccurrences(text, CODE_FENCE)
  if (fenceCount % 2 === 1) {
    text = enable ? fixUnclosedCodeFence(text) : guardUnclosedCodeFence(text)
  }

  if (!enable) {
    text = guardUnclosedMathBlock(text)
    text = guardTableStreaming(text)
    return text
  }

  text = fixUnclosedMathBlock(text)
  text = fixInlineCode(text)
  text = fixInlineMath(text)
  text = fixTableSyntax(text)
  text = fixLinksAndImages(text)
  return text
}

