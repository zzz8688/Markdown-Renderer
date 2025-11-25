import { useState } from 'react';
import { MarkdownViewer } from './MarkdownViewer';
import './style/playground.css';

// 测试用的 Markdown 文本
const defaultContent = `
# 前端 Markdown 渲染器测试样张

> 💡 **说明**：这是一个综合测试用例，用于检测 CSS 样式是否完善，覆盖了 GFM 核心语法及边界情况。

---

## 1. 基础排版 (Typography)

这是一段普通的文本，包含 **粗体 (Bold)**、*斜体 (Italic)* 以及 ~~删除线 (Strikethrough)~~。
当然，还有 \`行内代码 (Inline Code)\` 用于标记简短的指令。

### 链接与自动链接
- 普通链接：[访问 GitHub](https://github.com)
- 自动链接 (GFM)：https://www.google.com
- 邮箱链接：test@example.com

---

## 2. 列表嵌套 (Lists)

**无序列表嵌套：**
- 前端框架
  - React
    - Next.js
    - Remix
  - Vue
- 后端语言

**有序列表嵌套：**
1. 第一步：安装依赖
2. 第二步：编写代码
   1. 创建组件
   2. 编写 CSS
3. 第三步：打包发布

---

## 3. 引用块 (Blockquotes)

> 这是一个一级引用块。
> CSS 需要处理左边的竖线样式。
>
> > 这是一个嵌套的二级引用块。
> > 通常用于回复或强调。
>
> 回到一级引用。

---

## 4. 表格测试 (Tables)

### 普通表格
| 功能点 | 优先级 | 负责人 |
| :--- | :---: | ---: |
| GFM 支持 | ✅ P0 | @qyj |
| 公式渲染 | ⏳ P1 | @队友 |
| 样式美化 | 🎨 P2 | @qyj |

### ⚠️ 压力测试：超宽表格 (检测滚动条)
| ID | 用户名 | 邮箱地址 | 注册时间 | 最后登录IP | 浏览器版本 | 操作系统 | 备注信息 | 状态 | 操作 |
|----|--------|----------|----------|------------|------------|----------|----------|------|------|
| 1 | user_001 | very_long_email_address_test@example.com | 2023-10-01 | 192.168.1.1 | Chrome 120.0 | Windows 11 | 这是一个非常长的备注信息，用于测试表格在小屏幕下是否会撑破页面布局，应该出现横向滚动条。 | 正常 | 编辑 |

---

## 5. 代码块 (Code Blocks)

**普通代码块：**

\`\`\`
npm install react-markdown
npm run dev
\`\`\`

**带语言标记的代码块 (JavaScript)：**

\`\`\`javascript
function sayHello(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
\`\`\`

---

## 6. 图片与媒体 (Images)

应该限制最大宽度，防止图片超出容器。

![风景图占位符](https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80)

---

## 7. 边界情况测试 (Edge Cases)

**超长单词折行测试：**
这是一段用来测试 word-break 属性的文本：
VeryLongWordVeryLongWordVeryLongWordVeryLongWordVeryLongWordVeryLongWordVeryLongWord

**任务列表：**
- [x] 核心功能完成
- [ ] 样式细节打磨
- [ ] 移动端适配

`;

function App() {
  const [content, setContent] = useState(defaultContent);

  return (
    <div className="playground-container">
      {/* 左侧：输入区域 */}
      <div className="editor-area">
        <div className="area-title">Markdown 输入</div>
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)} 
          placeholder="在这里输入 Markdown..."
        />
      </div>

      {/* 右侧：预览区域 */}
      <div className="preview-area">
        <div className="area-title">实时预览</div>
        <div className="preview-content">
          <MarkdownViewer content={content} />
        </div>
      </div>
    </div>
  );
}

export default App;