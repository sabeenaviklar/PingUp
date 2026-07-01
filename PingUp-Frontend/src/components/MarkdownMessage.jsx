import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

export default function MarkdownMessage({ content, truncate }) {
  const customRenderers = {
    // Ensure all links open in a new tab securely
    a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
  };

  return (
    <div className={`markdown-body ${truncate ? 'markdown-truncate' : ''}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[rehypeSanitize]}
        components={customRenderers}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
