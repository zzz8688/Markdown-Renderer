/**
 * 虚拟滚动工具模块
 * 
 * 用于处理大文档的分块渲染，只渲染可视区域内的内容
 * 减少 DOM 节点数量，提升滚动性能
 */


export interface VirtualBlock {
  id: string
  content: string
  height: number
  top: number
  visible: boolean
}

export interface VirtualScrollState {
  blocks: VirtualBlock[]
  totalHeight: number
  visibleRange: { start: number; end: number }
}

/**
 * 将 HTML 内容按顶级元素分块
 * @param html 完整的 HTML 字符串
 * @returns 分块后的内容数组
 */
export function splitHtmlIntoBlocks(html: string): string[] {
  // 创建临时容器解析 HTML
  const template = document.createElement('template')
  template.innerHTML = html
  
  const blocks: string[] = []
  const children = template.content.children
  
  // 将相邻的小元素合并成一个块，避免块过多
  let currentBlock = ''
  let currentSize = 0
  const MIN_BLOCK_SIZE = 500 // 最小块大小（字符数）
  
  for (let i = 0; i < children.length; i++) {
    const child = children[i] as HTMLElement
    const childHtml = child.outerHTML
    
    // 大元素（表格、代码块、公式块等）单独成块
    const isLargeElement = 
      child.tagName === 'TABLE' ||
      child.tagName === 'PRE' ||
      child.classList.contains('math-display') ||
      child.classList.contains('md-callout') ||
      childHtml.length > 1000
    
    if (isLargeElement) {
      // 先保存之前累积的小块
      if (currentBlock) {
        blocks.push(currentBlock)
        currentBlock = ''
        currentSize = 0
      }
      // 大元素单独成块
      blocks.push(childHtml)
    } else {
      currentBlock += childHtml
      currentSize += childHtml.length
      
      // 累积到一定大小后分块
      if (currentSize >= MIN_BLOCK_SIZE) {
        blocks.push(currentBlock)
        currentBlock = ''
        currentSize = 0
      }
    }
  }
  
  // 处理剩余内容
  if (currentBlock) {
    blocks.push(currentBlock)
  }
  
  return blocks
}

/**
 * 可视范围计算：计算可视区域内应该渲染的块索引范围
 * @param scrollTop 滚动位置
 * @param viewportHeight 视口高度
 * @param blockHeights 每个块的高度数组
 * @param buffer 缓冲区块数（上下各多渲染几个块）
 */
export function calculateVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  blockHeights: number[],//每个块的高度数组
  buffer: number = 6 //虚拟滚动缓存区
): { start: number; end: number } {
  //数组为空时返回
  if (blockHeights.length === 0) {
    return { start: 0, end: 0 }
  }
  
  let accumulatedHeight = 0
  let startIndex = 0
  let endIndex = blockHeights.length - 1
  
  // 找到第一个可见块
  for (let i = 0; i < blockHeights.length; i++) {
    if (accumulatedHeight + blockHeights[i] >= scrollTop) {
      startIndex = Math.max(0, i - buffer)
      break
    }
    accumulatedHeight += blockHeights[i]
  }
  
  // 找到最后一个可见块
  const viewportBottom = scrollTop + viewportHeight
  accumulatedHeight = 0
  for (let i = 0; i < blockHeights.length; i++) {
    accumulatedHeight += blockHeights[i]
    if (accumulatedHeight >= viewportBottom) {
      endIndex = Math.min(blockHeights.length - 1, i + buffer)
      break
    }
  }
  
  return { start: startIndex, end: endIndex }
}


/**
 * 估算 HTML 块的高度（用于初始渲染前的估算）
 * @param html HTML 字符串
 */
export function estimateBlockHeight(html: string): number {
  // 基础高度
  let height = 20
  
  // 根据内容类型估算
  if (html.includes('<table')) {
    // 表格：按行数估算
    const rowCount = (html.match(/<tr/g) || []).length
    height = Math.max(40, rowCount * 35 + 40)
  } else if (html.includes('<pre')) {
    // 代码块：按行数估算
    const lineCount = (html.match(/\n/g) || []).length + 1
    height = Math.max(60, lineCount * 20 + 32)
  } else if (html.includes('math-display') || html.includes('katex-display')) {
    // 数学公式块
    height = 80
  } else if (html.includes('md-callout')) {
    // Callout 块
    const lineCount = (html.match(/<li|<p/g) || []).length
    height = Math.max(60, lineCount * 24 + 40)
  } else if (html.includes('<img')) {
    const textLength = html.replace(/<[^>]*>/g, '').length
    const textHeight = Math.ceil(textLength / 80) * 24
    const imgCount = (html.match(/<img/g) || []).length
    height = Math.max(200, imgCount * 400 + textHeight)
  } else {
    // 普通段落：按字符数估算
    const textLength = html.replace(/<[^>]*>/g, '').length
    height = Math.max(24, Math.ceil(textLength / 80) * 24)
  }
  
  return height
}

/**
 * 虚拟滚动管理器类
 * VirtualScrollManager 作为一个纯逻辑工具类，负责：
  根据完整 HTML 拆分块；
  对每个块预估高度；
  根据滚动条位置计算可视块范围；
  支持用真实 DOM 高度进行回填修正，让尾部和大块区域更精准。
 */
export class VirtualScrollManager {
  private blocks: string[] = []
  private blockHeights: number[] = []
  private measuredHeights: Map<number, number> = new Map() 
  private totalHeight: number = 0 //虚拟文档总体高度
  
  /**
   * 设置新的 HTML 内容
   */
  setContent(html: string): void {
    this.blocks = splitHtmlIntoBlocks(html) //调用splitHtmlIntoBlocks得到blocks
    this.blockHeights = this.blocks.map((block, index) => {
      // 优先使用已测量的高度
      return this.measuredHeights.get(index) ?? estimateBlockHeight(block)
    })
    //所有块累计的实际或预估高度
    this.totalHeight = this.blockHeights.reduce((sum, h) => sum + h, 0)
  }
  
  /**
   * 更新某个块的实际测量高度
   * @returns 是否真实更新了高度
   */
  updateBlockHeight(index: number, height: number): boolean {
    if (index < 0 || index >= this.blockHeights.length) return false
    if (!Number.isFinite(height) || height <= 0) return false

    const oldHeight = this.blockHeights[index]
    if (oldHeight === height) return false

    this.blockHeights[index] = height
    this.measuredHeights.set(index, height)
    this.totalHeight += height - oldHeight
    return true
  }
  
  /**
   * 获取可视区域的块
   * 回填更新会基于已修正后的 blockHeights调用此方法
   */
  getVisibleBlocks(scrollTop: number, viewportHeight: number): {
    blocks: Array<{ index: number; content: string; top: number }>
    totalHeight: number
    paddingTop: number
    paddingBottom: number
  } {
    //计算并返回可视块的起始与结束索引，用于确定当前应渲染的块范围
    const range = calculateVisibleRange(scrollTop, viewportHeight, this.blockHeights)
    
    // 计算顶部 padding（不可见块的总高度）
    let paddingTop = 0
    for (let i = 0; i < range.start; i++) {
      paddingTop += this.blockHeights[i]
    }
    
    // 计算底部 padding
    let paddingBottom = 0
    for (let i = range.end + 1; i < this.blockHeights.length; i++) {
      paddingBottom += this.blockHeights[i]
    }
    
    // 获取可见块
    const visibleBlocks: Array<{ index: number; content: string; top: number }> = []
    let currentTop = paddingTop
    for (let i = range.start; i <= range.end && i < this.blocks.length; i++) {
      visibleBlocks.push({
        index: i,
        content: this.blocks[i],
        top: currentTop,
      })
      currentTop += this.blockHeights[i]
    }
    // 不可见区域的高度总和 = paddingTop + paddingBottom
    return {
      blocks: visibleBlocks,
      totalHeight: this.totalHeight,
      paddingTop,
      paddingBottom,
    }
  }
  
  /**
   * 获取所有块（用于非虚拟滚动模式）
   */
  getAllBlocks(): string[] {
    return this.blocks
  }
  
  /**
   * 获取块数量
   */
  get blockCount(): number {
    return this.blocks.length
  }
  
  /**
   * 清空
   */
  clear(): void {
    this.blocks = []
    this.blockHeights = []
    this.measuredHeights.clear()
    this.totalHeight = 0
  }
}
