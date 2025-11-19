import { useEffect, useMemo, useState } from 'react'
import { renderMarkdown } from '../lib/markdown'
import './playground.css'

const DEFAULT_MD = `# 前端 Markdown 渲染器测试样张

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

## 公式渲染
当质量 $m$ 的物体以速度 $v$ 运动时，其动能 $E_k$ 定义为：

$$
E_k = \frac{1}{2}mv^2
$$
`

export default function Playground() {
  const [input, setInput] = useState<string>(DEFAULT_MD)
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    renderMarkdown(input).then((out) => {
      if (!active) return
      setHtml(out)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [input])

  const preview = useMemo(() => ({ __html: html }), [html])

  return (
    <div className="pg-container">
      <div className="pg-pane pg-left">
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
