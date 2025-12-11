import { useCallback, useEffect, useLayoutEffect, useRef, useState, startTransition } from 'react'
import './playground.css'
import { Smoother } from '../lib/smoother'
import { applyMarkdownAutoFix as applyAutoFix } from '../lib/markdownAutoFix'
import { renderMarkdown } from '../lib/markdown'
import { ImageLazyLoader, enhanceImages } from '../lib/imageLazyLoad'
import { VirtualScrollManager } from '../lib/virtualScroll'

// Playground 组件：左侧 Markdown 输入 + 右侧预览，演示流式渲染 + 虚拟滚动 + 图片懒加载
//String.raw不进行转义处理
const DEFAULT_MD = String.raw`# 前端 Markdown 渲染器测试样张

这是一个用于测试渲染器功能的综合示例。

[Google](https://google.com)

[ByteDance](https://www.bytedance.com)

![logo](https://api.starlink.com/public-files/home_b_roam_m.jpg)

## GFM 语法

### 任务列表
- [ ] 支持流式渲染
- [x] 支持 GFM 语法
- [x] 支持公式

### 表格
| 功能点 | 优先级 | 负责人 |
| --- | :---: | ---: |
| GFM 支持 | P0 | @sunzhongda |
| 公式渲染 | P1 | @sunzhongda |
| 指令扩展 | P1 | @sunzhongda |

### 脚注
这是一个包含脚注的句子[^1]。

[^1]: 这是脚注的具体内容，并无任何解释，悬停应该可以看见。

## 公式渲染

当质量 $m$ 的物体以速度 $v$ 运动时，其动能 $E_k$ 由以下公式定义：

$$
E_k = \frac{1}{2}mv^2
$$
这是块级公式。

$
E_k = \frac{1}{2}mv^2
$
这是行内公式。

这个公式是经典力学的基础。

## 扩展指令（加分项）

能看见  !!! 最新的改动，形成对文字的遮挡效果，鼠标悬停时才会显示 !!!  的部分

你可以使用指令来创建一些特殊的 UI 元素。

这是一个成功状态的徽章 :badge[Success]{type=success}，和一个警告状态的徽章 :badge[Warning]{type=warning}。

:::callout[这是一个提示]
你可以在这里写下需要引起用户注意的详细信息。
- 列表项 1
- 列表项 2
:::

:::callout[危险操作]{type=danger}
这是一个表示危险操作的警告框，请谨慎操作！
:::

## 遮盖

能看见  !!! 最新的改动，形成对文字的遮挡效果，鼠标悬停时才会显示 !!!  的部分


$ E_k = \frac{1}{2}mv^2
`
//TSX 现在只关心 UI + 流式控制。
const VIRTUAL_SCROLL_HTML_THRESHOLD = 8000 //html长度阈值，大于这个值时启用虚拟滚动

//限制输入数字范围
function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  if (value < min) return min
  if (value > max) return max
  return value
}

export default function Playground() {
  // 1）基础 UI 与渲染控制状态
  const [input, setInput] = useState<string>(DEFAULT_MD) //作为input初始值
  const [html, setHtml] = useState<string>('') //作为html初始值
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [autoFix, setAutoFix] = useState<boolean>(true)
  // 流式渲染参数（可在左侧控制面板中动态调整）
  const [baseSpeed, setBaseSpeed] = useState<number>(500)
  const [maxVelocity, setMaxVelocity] = useState<number>(2000)
  const [acceleration, setAcceleration] = useState<number>(2)
  const [damping, setDamping] = useState<number>(0.85)

  // Smoother 实例：负责把离散的文本 chunk 平滑成逐字输出的“流式体验”
  const [smoother] = useState(() => new Smoother({ baseSpeed, maxVelocity, acceleration, damping }))

  // 2）流式控制：定时器与进度引用，记录当前流式演示的状态
  const timerRef = useRef<number | null>(null)
  const textRef = useRef<string>('')
  const indexRef = useRef<number>(0)
  const pendingRef = useRef<string>('')
  const renderTimerRef = useRef<number | null>(null)
  const prevHtmlRef = useRef<string>('')
  const renderIdleRef = useRef<boolean>(false)
  const stickToBottomRef = useRef<boolean>(true)
  const loadingDelayRef = useRef<number | null>(null)
  const loadedImgSrcsRef = useRef<Set<string>>(new Set())
  // 预览区域引用：用于自动滚动跟随
  const previewRef = useRef<HTMLDivElement | null>(null)
  // 图片懒加载管理器
  const imageLoaderRef = useRef<ImageLazyLoader | null>(null)
  // 3）Markdown 渲染 Web Worker 相关引用：把重计算放到后台线程，避免主线程卡顿
  const workerRef = useRef<Worker | null>(null)
  const workerRequestIdRef = useRef<number>(0)
  const workerPendingMapRef = useRef<
    Map<number, { resolve: (value: string) => void; reject: (reason?: unknown) => void }>
  >(new Map())
  // 4）虚拟滚动管理器：根据完整 HTML 拆分块并维护每块高度
  const virtualManagerRef = useRef<VirtualScrollManager | null>(null)
  const [useVirtualScroll, setUseVirtualScroll] = useState(false)
  
  //VirtualScrollManager的输出都集中在virtualState中
  const [virtualState, setVirtualState] = useState({
    blocks: [] as Array<{ index: number; content: string; top: number }>,
    paddingTop: 0,
    paddingBottom: 0,
    totalHeight: 0,
  })
  //md渲染交给worker
  const renderMarkdownInWorker = useCallback((markdown: string): Promise<string> => {
    const worker = workerRef.current
    // Worker 不可用时回退到主线程渲染，避免流式渲染彻底失效
    if (!worker) {
      return renderMarkdown(markdown)
    }
    const id = workerRequestIdRef.current + 1
    workerRequestIdRef.current = id
    return new Promise((resolve, reject) => {
      workerPendingMapRef.current.set(id, { resolve, reject })
      worker.postMessage({ id, markdown })
    })
  }, [])

  // 当左侧数值参数变化时，实时更新 Smoother 的运动学配置
  useEffect(() => {
    smoother.setSpeed({ baseSpeed, maxVelocity, acceleration, damping })
  }, [baseSpeed, maxVelocity, acceleration, damping, smoother])

  // 创建并管理 Markdown 渲染 Worker：把 Markdown -> HTML 的解析放到独立线程
  useEffect(() => {
    const worker = new Worker(new URL('../lib/markdownWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker

    const handleMessage = (event: MessageEvent<{ id: number; ok: boolean; html?: string; error?: string }>) => {
      const data = event.data
      if (!data) return
      const pending = workerPendingMapRef.current.get(data.id)
      if (!pending) return
      workerPendingMapRef.current.delete(data.id)
      if (data.ok && typeof data.html === 'string') {
        pending.resolve(data.html)
      } else {
        pending.reject(new Error(data.error || 'Markdown render failed'))
      }
    }

    const handleError = (event: ErrorEvent) => {
      workerPendingMapRef.current.forEach(({ reject }) => {
        reject(event.error || new Error('Markdown worker error'))
      })
      workerPendingMapRef.current.clear()
      // 标记 worker 已不可用，后续渲染将自动回退到主线程
      workerRef.current = null
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)

    return () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
      worker.terminate()
      workerRef.current = null
      workerPendingMapRef.current.forEach(({ reject }) => {
        reject(new Error('Markdown worker terminated'))
      })
      workerPendingMapRef.current.clear()
    }
  }, [])

  // 初始化虚拟滚动管理器，在组件生命周期内复用同一个实例
  useEffect(() => {
    virtualManagerRef.current = new VirtualScrollManager()
    return () => {
      virtualManagerRef.current?.clear()
      virtualManagerRef.current = null
    }
  }, [])

  // RAF 渲染循环：逐字吐出，然后按需渲染 Markdown
  useEffect(() => {
    let running = true
    let inFlight = false
    let lastText = ''
    function scheduleRender(text: string) {
      pendingRef.current = text
      if (inFlight || text === lastText) return
      if (renderTimerRef.current != null) return
      // 测量"接近底部"，在渲染前保持粘性
      const el = previewRef.current
      if (el) {
        //判断是否接近底部，粘低阈值设置为50px
        const nearBottomBefore = el.scrollHeight - el.scrollTop - el.clientHeight < 50
        stickToBottomRef.current = nearBottomBefore
      }
      //渲染函数
      const runRender = async () => {
        renderTimerRef.current = null
        if (inFlight) return
        inFlight = true
        // loading延迟100ms
        if (loadingDelayRef.current == null) {
          loadingDelayRef.current = window.setTimeout(() => {
            setLoading(true)
          }, 100)
        }
        try {
          while (running) {
            const raw = pendingRef.current
            const toRender = applyAutoFix(raw, { enable: autoFix })
            lastText = raw
            try {
              const out = await renderMarkdownInWorker(toRender)
              if (!running) return
              startTransition(() => {
                setError(null)
                if (out !== prevHtmlRef.current) {
                  prevHtmlRef.current = out
                  setHtml(out)
                }
              })
            } catch (e: any) {
              const message = e instanceof Error ? e.message : String(e)
              if (!running) return
              startTransition(() => {
                setError(message)
              })
              break
            }
            if (pendingRef.current === raw) break
          }
        } finally {
          inFlight = false
          if (loadingDelayRef.current != null) {
            clearTimeout(loadingDelayRef.current)
            loadingDelayRef.current = null
          }
          setLoading(false)
        }
      }
      const ric = (window as any).requestIdleCallback as undefined | ((cb: Function, opts?: { timeout: number }) => number)
      if (ric) {
        renderIdleRef.current = true
        renderTimerRef.current = ric(runRender, { timeout: 180 }) as unknown as number
      } else {
        renderIdleRef.current = false
        renderTimerRef.current = window.setTimeout(runRender, 160)
      }
    }
    //RAF渲染循环：逐字吐出，然后按需渲染Markdown
    function loop() {
      if (!running) return
      //smoother.tick()逐字吐出
      // next===output是到当前为止所有已经输出的完整前缀字符串
      const next = smoother.tick()
      if (next !== lastText) {
        //按需触发渲染
        scheduleRender(next)
      }
      const idle = smoother.state.queueLength === 0
      if (idle) {
        //空闲时，延迟120ms后继续渲染
        window.setTimeout(() => {
          if (running) requestAnimationFrame(loop)
        }, 120)
      } else {
        requestAnimationFrame(loop)
      }
    }
    //开始渲染循环
    requestAnimationFrame(loop)
    return () => {
      running = false
      const id = renderTimerRef.current
      if (id != null) {
        const cic = (window as any).cancelIdleCallback as undefined | ((id: number) => void)
        if (renderIdleRef.current && cic) {
          cic(id)
        } else {
          clearTimeout(id)
        }
        renderTimerRef.current = null
      }
    }
  }, [smoother, autoFix, renderMarkdownInWorker])

  //HTML更新
  useEffect(() => {
    const el = previewRef.current
    if (!el) return

    const shouldUseVirtual = html.length > VIRTUAL_SCROLL_HTML_THRESHOLD
    const manager = virtualManagerRef.current

    // 短文档：不使用虚拟滚动，由 React 直接渲染整个 HTML
    if (!shouldUseVirtual || !manager) {
      setUseVirtualScroll(false)
      setVirtualState((prev) =>
        prev.blocks.length || prev.paddingTop || prev.paddingBottom || prev.totalHeight
          ? { blocks: [], paddingTop: 0, paddingBottom: 0, totalHeight: 0 }
          : prev
      )
      return
    }

    // 长文档：使用虚拟滚动，只渲染可视块
    setUseVirtualScroll(true)
    manager.setContent(html)
    const scrollTop = el.scrollTop
    const viewportHeight = el.clientHeight || el.offsetHeight || 0
    const { blocks, paddingTop, paddingBottom, totalHeight } = manager.getVisibleBlocks(
      scrollTop,
      viewportHeight
    )
    setVirtualState({ blocks, paddingTop, paddingBottom, totalHeight })
  }, [html])

  //滚动触发handlePreviewScroll
  const handlePreviewScroll = useCallback(() => {
    if (!useVirtualScroll) return
    const el = previewRef.current
    const manager = virtualManagerRef.current
    if (!el || !manager) return

    const scrollTop = el.scrollTop
    const viewportHeight = el.clientHeight || el.offsetHeight || 0
    //调用getVisibleBlocks计算可视块范围
    const { blocks, paddingTop, paddingBottom, totalHeight } = manager.getVisibleBlocks(
      scrollTop,
      viewportHeight
    )
    setVirtualState({ blocks, paddingTop, paddingBottom, totalHeight })

    // 根据当前滚动位置动态更新“是否贴底”状态
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    stickToBottomRef.current = nearBottom
  }, [useVirtualScroll])

  // 挂载时创建全局图片懒加载器
  useEffect(() => {
    const el = previewRef.current
    imageLoaderRef.current = new ImageLazyLoader({
      root: el,
      rootMargin: '300px 0px', // 提前 300px 开始加载
      fadeIn: true,
      fadeInDuration: 250,
    })

    return () => {
      imageLoaderRef.current?.destroy()
      imageLoaderRef.current = null
    }
  }, [])

  // 图片加载骨架屏（使用优化后的懒加载模块）
  // 每次 HTML / 虚拟滚动变化后，增强当前 DOM 里的所有图片
  // 使用 useLayoutEffect，确保在浏览器绘制之前就完成图片包装与骨架处理，避免先渲染原始尺寸再跳到 400x400 的闪烁
  useLayoutEffect(() => {
    const el = previewRef.current
    const loader = imageLoaderRef.current
    if (!el || !loader) return

    // 使用优化后的图片增强函数
    enhanceImages(el, loader, loadedImgSrcsRef.current)
  }, [html, virtualState])



  // 根据实际渲染结果回填虚拟块高度，提升滚动末尾精度并减少跨大块时的跳跃感
  // 回填触发在React commit后
  useLayoutEffect(() => {
    if (!useVirtualScroll) return
    const el = previewRef.current
    const manager = virtualManagerRef.current
    if (!el || !manager) return

    let updated = false
    const nodes = el.querySelectorAll<HTMLElement>('[data-block-index]')
    nodes.forEach((node) => {
      const indexAttr = node.getAttribute('data-block-index')
      if (!indexAttr) return
      const index = Number(indexAttr)
      if (!Number.isFinite(index)) return

      const height = node.offsetHeight //测量真实高度
      if (!height) return
      // 只在高度真有变化时才认为“更新”，回填到 VirtualScrollManager
      if (manager.updateBlockHeight(index, height)) {
        updated = true
      }
    })
    // 只有任何块高度被修正，才触发一次新的虚拟范围计算 + 状态更新
    if (updated) {
      const scrollTop = el.scrollTop
      const viewportHeight = el.clientHeight || el.offsetHeight || 0
      const { blocks, paddingTop, paddingBottom, totalHeight } = manager.getVisibleBlocks(
        scrollTop,
        viewportHeight
      )
      //驱动setVirtualState更新
      setVirtualState({ blocks, paddingTop, paddingBottom, totalHeight })
    }
  }, [useVirtualScroll, virtualState.blocks])

  // 在 HTML 或虚拟高度更新后自动滚动到底部，保持视图跟随最新渲染内容
  // 仅在流式演示进行中（timerRef.current != null）时启用自动粘底，
  // 渲染完成后不再强制修改滚动位置，避免用户手动滚动到底部时被“弹回”
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    // 等待下一帧，确保 DOM、虚拟块和图片包装都已完成布局
    requestAnimationFrame(() => {
      if (timerRef.current != null && stickToBottomRef.current) {
        el.scrollTop = el.scrollHeight
      }
    })
  }, [html, virtualState.totalHeight])

  // 启动一个基于当前输入的模拟流：随机 chunk 尺寸与间隔
  const startStream = () => {
    // 若已有流在跑，先停止
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // 重置
    smoother.reset()
    setHtml('')
    setLoading(false)

    textRef.current = input
    indexRef.current = 0

    const t = window.setInterval(() => {
      const text = textRef.current
      let i = indexRef.current
      if (i >= text.length) {
        // 尾包：极速收敛
        smoother.receiveTailChunk('')
        if (timerRef.current != null) clearInterval(timerRef.current)
        timerRef.current = null
        return
      }
      const size = Math.max(5, Math.floor(10 + Math.random() * 40))
      const chunk = text.slice(i, i + size)
      i += size
      indexRef.current = i
      // 普通数据包
      if (i >= text.length) {
        // 最后一包当作尾包处理，确保结构一次性正确
        smoother.receiveTailChunk(chunk)
        if (timerRef.current != null) clearInterval(timerRef.current)
        timerRef.current = null
      } else {
        smoother.push(chunk)
      }
    }, 120 + Math.floor(Math.random() * 200))

    timerRef.current = t
  }

  return (
    <div className={`pg-container pg-theme-${theme}`}>
      {/* 左侧：输入区 + 工具栏 */}
      <div className="pg-pane pg-left">
        <div
          className="pg-toolbar"
          style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center', gap: 5 }}
        >
          <button onClick={startStream} style={{ fontSize: '18px', marginRight: '15px' }}>
            流式演示
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ fontSize: '18px', marginRight: '15px' }}
          >
            {theme === 'dark' ? '浅色主题' : '深色主题'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={autoFix}
              onChange={(e) => setAutoFix(e.target.checked)}
            />
            <span>自动修复Markdown</span>
          </label>

          {/* 换行：后面的参数调节控件移动到第二行 */}
          <div style={{ flexBasis: '100%', height: 0 }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 24,
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
              <div>初速</div>
              <input
                type="number"
                value={baseSpeed}
                min={1}
                max={500}
                onChange={(e) =>
                  setBaseSpeed(clampNumber(Number(e.target.value), 1, 500, 1))
                }
                style={{ textAlign: 'center' }}
              />
            </label>
            <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
              <div>最大速度</div>
              <input
                type="number"
                value={maxVelocity}
                min={5}
                max={2000}
                onChange={(e) =>
                  setMaxVelocity(clampNumber(Number(e.target.value), 5, 2000, 5))
                }
                style={{ textAlign: 'center' }}
              />
            </label>
            <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
              <div>加速度</div>
              <input
                type="number"
                value={acceleration}
                step={0.5}
                min={0}
                max={50}
                onChange={(e) =>
                  setAcceleration(clampNumber(Number(e.target.value), 0, 50, 0))
                }
                style={{ textAlign: 'center' }}
              />
            </label>
            <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
              <div>阻尼</div>
              <input
                type="number"
                value={damping}
                step={0.01}
                min={0}
                max={0.99}
                onChange={(e) =>
                  setDamping(clampNumber(Number(e.target.value), 0, 0.99, 0.85))
                }
                style={{ textAlign: 'center' }}
              />
            </label>
          </div>
        </div>
        {/* Markdown 输入区域 */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="pg-textarea"
        />
      </div>

      {/* 右侧：预览区 */}
      <div className="pg-pane pg-right">
        {loading ? <div className="pg-loading">渲染中...</div> : null}
        {error ? (
          <div className="pg-error-callout">解析失败：{error}</div>
        ) : null}
        <div
          ref={previewRef}
          className="pg-preview"
          onScroll={useVirtualScroll ? handlePreviewScroll : undefined}
        >
          {useVirtualScroll ? (
            <div
              style={{
                paddingTop: virtualState.paddingTop,
                paddingBottom: virtualState.paddingBottom,
              }}
            >
              {/*React根据virtualState渲染当前可视区域的块 */}
              {virtualState.blocks.map((block) => (
                <div
                  key={block.index}
                  data-block-index={block.index}
                  dangerouslySetInnerHTML={{ __html: block.content }}
                />
              ))}
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </div>
    </div>
  )
}
