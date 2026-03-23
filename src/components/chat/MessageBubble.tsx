'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const mdComponents: Components = {
  // Tables
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-xs border-collapse border border-[var(--border)] rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-[var(--surface-2)]">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-[var(--text-muted)] font-medium border-b border-[var(--border)] whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-[var(--text-secondary)] border-b border-[var(--border)] last:border-b-0">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-[var(--surface-2)] transition-colors">{children}</tr>
  ),
  // Text elements
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[var(--text-secondary)]">{children}</em>,
  // Lists
  ul: ({ children }) => <ul className="mb-3 space-y-1 list-none">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 space-y-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="flex gap-2 text-[var(--text-secondary)]">
      <span className="text-[#DA7756] shrink-0 mt-0.5">•</span>
      <span>{children}</span>
    </li>
  ),
  // Headings
  h1: ({ children }) => <h1 className="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1.5 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-2 mb-1 first:mt-0">{children}</h3>,
  // Code
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <pre className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 my-3 overflow-x-auto">
          <code className="text-xs text-[var(--text-secondary)] font-mono">{children}</code>
        </pre>
      )
    }
    return (
      <code className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[11px] text-[#DA7756] font-mono">
        {children}
      </code>
    )
  },
  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#DA7756]/50 pl-3 my-2 text-[var(--text-muted)] italic">
      {children}
    </blockquote>
  ),
  // Horizontal rule
  hr: () => <hr className="border-[var(--border)] my-4" />,
  // Links
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#DA7756] underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  ),
}

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-[var(--user-bubble-bg)] text-[var(--user-bubble-text)] rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-6">
      <div className="w-7 h-7 bg-[#DA7756] rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
        M
      </div>
      <div className="flex-1 text-sm text-[var(--text-primary)] leading-relaxed min-w-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
