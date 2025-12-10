// 辅助 Web Worker 中的 Markdown 渲染逻辑

import { renderMarkdown } from './markdown'

/**
 * Web Worker 请求数据
 */
interface MarkdownWorkerRequest {
  id: number // 请求 ID
  markdown: string // Markdown 内容
}

/**
 * Web Worker 成功响应数据
 */
interface MarkdownWorkerSuccess {
  id: number // 请求 ID
  ok: true // 操作结果
  html: string // 渲染后的 HTML
}

/**
 * Web Worker 错误响应数据
 */
interface MarkdownWorkerError {
  id: number // 请求 ID
  ok: false // 操作结果
  error: string // 错误信息
}

/**
 * Web Worker 响应数据
 */
type MarkdownWorkerResponse = MarkdownWorkerSuccess | MarkdownWorkerError

/**
 * Web Worker 消息事件处理函数
 * @param event 消息事件
 */
self.addEventListener('message', async (event: MessageEvent<MarkdownWorkerRequest>) => {
  const data = event.data //主线程发过来的消息
  if (!data) return
  const { id, markdown } = data
  try {
    //使用renderMarkdown渲染markdown,用到LRU缓存
    const html = await renderMarkdown(markdown ?? '') //返回的HTML字符串赋值
    //发送给主线程
    const response: MarkdownWorkerResponse = { id, ok: true, html }
    ;(self as any).postMessage(response)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const response: MarkdownWorkerResponse = { id, ok: false, error: message }
    ;(self as any).postMessage(response)
  }
})

export {}
