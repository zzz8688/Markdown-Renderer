import { useState } from 'react';
import MarkdownPreview from './components/MarkdownPreview';
import './App.css';

function App() {
  const [markdown, setMarkdown] = useState('');
  const [enableSyntaxFix, setEnableSyntaxFix] = useState(true); // 语法修复开关状态

  return (
    <div className="app-container">
      <div className="editor-section">
        <h3>Markdown 输入</h3>
        <textarea
          className="markdown-input"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder="在此输入 Markdown 内容..."
        />
        
        {/* 语法修复开关 */}
        <div className="options-section">
          <label className="option-label">
            <input
              type="checkbox"
              checked={enableSyntaxFix}
              onChange={(e) => setEnableSyntaxFix(e.target.checked)}
            />
            启用语法修复（自动闭合未完成的代码块等）
          </label>
        </div>
      </div>
      
      <div className="preview-section">
        <h3>渲染预览</h3>
        <div className="preview-content">
          <MarkdownPreview 
            rawMarkdown={markdown} 
            config={{
              initialSpeed: 'slow',
              maxSpeed: 'medium',
              showStatus: true,
              enableSyntaxFix // 传递语法修复开关状态
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;