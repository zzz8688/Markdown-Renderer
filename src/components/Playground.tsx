import { useEffect, useMemo, useState } from 'react'
import { renderMarkdown } from '../lib/markdown'
import './playground.css'
import { Smoother } from '../lib/smoother'

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
`

export default function Playground() {
  const [input, setInput] = useState<string>(DEFAULT_MD)
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [baseSpeed, setBaseSpeed] = useState<number>(5)
  const [maxVelocity, setMaxVelocity] = useState<number>(20)
  const [acceleration, setAcceleration] = useState<number>(2)
  const [damping, setDamping] = useState<number>(0.85)

  // Smoother 实例
  const [smoother] = useState(() => new Smoother({ baseSpeed, maxVelocity, acceleration, damping }))

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
      if (inFlight || text === lastText) return
      inFlight = true
      setLoading(true)
      lastText = text
      try {
        const out = await renderMarkdown(text)
        if (!running) return
        setHtml(out)
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
  }, [smoother])

  // 启动一个基于当前输入的模拟流：随机 chunk 尺寸与间隔
  const startStream = () => {
    // 重置
    smoother.reset()
    setHtml('')
    setLoading(false)

    const text = input
    let i = 0
    const timer = setInterval(() => {
      if (i >= text.length) {
        // 尾包：极速收敛
        smoother.receiveTailChunk('')
        clearInterval(timer)
        return
      }
      const size = Math.max(5, Math.floor(10 + Math.random() * 40))
      const chunk = text.slice(i, i + size)
      i += size
      // 普通数据包
      if (i >= text.length) {
        // 最后一包当作尾包处理，确保结构一次性正确
        smoother.receiveTailChunk(chunk)
        clearInterval(timer)
      } else {
        smoother.push(chunk)
      }
    }, 120 + Math.floor(Math.random() * 200))
  }

  // 立即 flush：等同尾包到达后一次性补全
  const flushTail = () => {
    const full = smoother.flushAll()
    void (async () => {
      setLoading(true)
      try {
        const out = await renderMarkdown(full)
        setHtml(out)
      } finally {
        setLoading(false)
      }
    })()
  }

  const preview = useMemo(() => ({ __html: html }), [html])

  return (
    <div className="pg-container">
      <div className="pg-pane pg-left">
        <div className="pg-toolbar">
          <button onClick={startStream}>流式演示</button>
          <button onClick={flushTail}>尾包补齐</button>
          <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
            <div>初速</div>
            <input
              type="number"
              value={baseSpeed}
              min={1}
              max={50}
              onChange={(e) => setBaseSpeed(Number(e.target.value) || 1)}
              style={{ width: 50 ,textAlign: 'center'}}
              
            />
          </label>
          <label style={{ display: 'grid', alignItems: 'center', gap: 6 }}>
            <div>最大速</div>
            <input
              type="number"
              value={maxVelocity}
              min={5}
              max={200}
              onChange={(e) => setMaxVelocity(Number(e.target.value) || 5)}
              style={{ width: 60 ,textAlign: 'center'}}
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
              style={{ width: 60 ,textAlign: 'center'}}
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
              style={{ width: 50 ,textAlign: 'center'}}
            />
          </label>
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
        <div className="pg-preview" dangerouslySetInnerHTML={preview} />
      </div>
    </div>
  )
}
