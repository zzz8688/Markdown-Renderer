import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'; 
import './style/markdown-styles.css';

interface Props {
  content: string;
}

export const MarkdownViewer: React.FC<Props> = ({ content }) => {
  return (
    <div className="markdown-body">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};