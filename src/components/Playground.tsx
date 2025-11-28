import { useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown } from '../lib/markdown'
import './playground.css'
import { Smoother } from '../lib/smoother'
//String.raw不进行转义处理
const DEFAULT_MD = String.raw`# 前端 Markdown 渲染器测试样张

这是一个用于测试渲染器功能的综合示例。

## GFM 语法

### 任务列表
- [x] 支持流式渲染
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

这个公式是经典力学的基础。

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

能看见  !!! 最新的改动，形成对文字的遮挡效果，鼠标悬停时才会显示 !!!  的部分


`

export default function Playground() {
  const [input, setInput] = useState<string>(DEFAULT_MD)//作为input初始值
  const [html, setHtml] = useState<string>('')//作为html初始值
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [autoFix, setAutoFix] = useState<boolean>(false)
  const [baseSpeed, setBaseSpeed] = useState<number>(5)
  const [maxVelocity, setMaxVelocity] = useState<number>(20)
  const [acceleration, setAcceleration] = useState<number>(2)
  const [damping, setDamping] = useState<number>(0.85)

  // Smoother 实例
  const [smoother] = useState(() => new Smoother({ baseSpeed, maxVelocity, acceleration, damping }))

  // 流式控制：定时器与进度引用
  const timerRef = useRef<number | null>(null)
  const textRef = useRef<string>('')
  const indexRef = useRef<number>(0)
  const pendingRef = useRef<string>('')
  // 预览区域引用：用于自动滚动跟随
  const previewRef = useRef<HTMLDivElement | null>(null)

  function applyAutoFix(markdown: string): string {
    const fence = '```'
    const count = markdown.split(fence).length - 1
    if (count % 2 === 1) {
      if (autoFix) {
        return markdown + '\n```'
      } else {
        const i = markdown.lastIndexOf(fence)
        if (i !== -1) {
          return markdown.slice(0, i) + '``\u200B`' + markdown.slice(i + fence.length)
        }
      }
    }
    return markdown
  }

  // 同步速度配置
  useEffect(() => {
    smoother.setSpeed({ baseSpeed, maxVelocity, acceleration, damping })
  }, [baseSpeed, maxVelocity, acceleration, damping, smoother])

  // RAF 渲染循环：逐字吐出，然后按需渲染 Markdown
  useEffect(() => {
    let running = true
    let inFlight = false
    let lastText = ''
    async function maybeRender(text: string) {
      pendingRef.current = text
      if (inFlight || text === lastText) return
      inFlight = true
      setLoading(true)
      try {
        // 持续消费最新文本，直到队列稳定
        while (running) {
          const raw = pendingRef.current
          const toRender = applyAutoFix(raw)
          lastText = raw
          try {
            const out = await renderMarkdown(toRender)
            if (!running) return
            setError(null)
            setHtml(out)
          } catch (e: any) {
            const message = e instanceof Error ? e.message : String(e)
            if (!running) return
            setHtml('')
            setError(message)
            break
          }
          if (pendingRef.current === raw) break
        }
      } finally {
        inFlight = false
        setLoading(false)
      }
    }

    function loop() {
      if (!running) return
      const next = smoother.tick()
      if (next !== lastText) {
        void maybeRender(next)
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    return () => {
      running = false
    }
  }, [smoother, autoFix])

  // 在 HTML 更新后自动滚动到底部，保持视图跟随最新渲染内容
  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    // 等待下一帧，确保 DOM 已完成更新和布局
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [html])

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

  const preview = useMemo(() => ({ __html: html }), [html])

  return (
    <div className={`pg-container pg-theme-${theme}`}>
      <div className="pg-pane pg-left">
        
        <div className="pg-toolbar" 
        style={{ textAlign: 'center', justifyContent: 'center', alignItems: 'center', gap: 5}}> 
          <button onClick={startStream} style={{ fontSize: '18px' ,marginRight: '15px'}}>流式演示</button>
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ fontSize: '18px' ,marginRight: '15px'}}
          >
            {theme === 'dark' ? '浅色主题' : '深色主题'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={autoFix}
              onChange={(e) => setAutoFix(e.target.checked)}
            />
            <span>自动修复代码块</span>
          </label>
          

         
          {/* 换行：后面的参数调节控件移动到第二行 */}
          <div style={{ flexBasis: '100%', height: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, flexWrap: 'wrap', width: '100%' }}>
            <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
              <div>初速</div>
              <input
                type="number"
                value={baseSpeed}
                min={1}
                max={50}
                onChange={(e) => setBaseSpeed(Number(e.target.value) || 1)}
                style={{ textAlign: 'center' }}
              />
            </label>
            <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
              <div>最大速度</div>
              <input
                type="number"
                value={maxVelocity}
                min={5}
                max={200}
                onChange={(e) => setMaxVelocity(Number(e.target.value) || 5)}
                style={{ textAlign: 'center'}}
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
                onChange={(e) => setAcceleration(Number(e.target.value) || 0)}
                style={{ textAlign: 'center'}}
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
                onChange={(e) => setDamping(Number(e.target.value) || 0.85)}
                style={{ textAlign: 'center'}}
              />
            </label>
          </div>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="pg-textarea"
        />
      </div>
      <div className="pg-pane pg-right">
        {loading ? <div className="pg-loading">渲染中...</div> : null}
        {error ? (
          <div className="pg-error-callout">
            解析失败：{error}
          </div>
        ) : null}
        <div ref={previewRef} className="pg-preview" dangerouslySetInnerHTML={preview} />
      </div>
    </div>
  )
}
