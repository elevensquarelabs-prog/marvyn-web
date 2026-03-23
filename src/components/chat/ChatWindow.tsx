'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { ToolCallIndicator } from './ToolCallIndicator'
import { Button } from '@/components/shared/Button'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

const QUICK_CHIPS = [
  'What should I focus on this week?',
  'Analyze my ad campaigns',
  'Write a blog post about our product',
  'Create a LinkedIn post',
  'Run an SEO audit',
]

const SKILL_CHIPS: { id: string; label: string; icon: string; prompt: string }[] = [
  { id: 'paid-ads', label: 'Paid Ads', icon: '📊', prompt: 'Help me with paid advertising strategy.' },
  { id: 'seo-audit', label: 'SEO Audit', icon: '🔍', prompt: 'Run an SEO analysis and give me recommendations.' },
  { id: 'copywriting', label: 'Write Copy', icon: '✍️', prompt: 'Help me write compelling marketing copy.' },
  { id: 'email-sequence', label: 'Email Sequence', icon: '📧', prompt: 'Help me build an email sequence.' },
  { id: 'content-strategy', label: 'Content Strategy', icon: '📅', prompt: 'Help me plan a content strategy.' },
  { id: 'social-content', label: 'Social Posts', icon: '📱', prompt: 'Help me create social media content.' },
]

interface Props {
  onAgentStatusChange?: (status: string, tool?: string) => void
  initialSessionId?: string | null
  initialMessages?: ChatMessage[]
  onSessionCreated?: (sessionId: string, title: string) => void
}

export function ChatWindow({ onAgentStatusChange, initialSessionId, initialMessages, onSessionCreated }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const [streaming, setStreaming] = useState(false)
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Reset when switching sessions
  useEffect(() => {
    setMessages(initialMessages ?? [])
    setSessionId(initialSessionId ?? null)
  }, [initialSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string, skillOverride?: string) => {
    if (!text.trim() || loading) return

    const skill = skillOverride ?? activeSkill
    const userMsg: ChatMessage = { role: 'user', content: text, createdAt: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setStreaming(true)
    onAgentStatusChange?.('running', 'Thinking…')

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, skillId: skill }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      let assistantMsgAdded = false
      let firstMessage = messages.length === 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'session') {
              setSessionId(data.sessionId)
              if (firstMessage) {
                onSessionCreated?.(data.sessionId, text.slice(0, 60))
                firstMessage = false
              }
            } else if (data.type === 'delta') {
              assistantContent += data.content
              if (!assistantMsgAdded) {
                setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }])
                assistantMsgAdded = true
              } else {
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
                  return updated
                })
              }
            } else if (data.type === 'done') {
              onAgentStatusChange?.('idle')
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
      onAgentStatusChange?.('idle')
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }, [loading, sessionId, activeSkill, messages.length, onAgentStatusChange, onSessionCreated])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const activateSkill = (chip: typeof SKILL_CHIPS[0]) => {
    if (activeSkill === chip.id) {
      setActiveSkill(null)
    } else {
      setActiveSkill(chip.id)
      if (messages.length === 0) {
        sendMessage(chip.prompt, chip.id)
      }
    }
  }

  const activeSkillData = SKILL_CHIPS.find(s => s.id === activeSkill)

  return (
    <div className="flex flex-col h-full">
      {/* Skill chips */}
      <div className="px-6 py-2 border-b border-[#1E1E1E] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
        <span className="text-[10px] text-[#444] font-medium uppercase tracking-wider mr-1 shrink-0">Skills:</span>
        {SKILL_CHIPS.map(chip => (
          <button
            key={chip.id}
            onClick={() => activateSkill(chip)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-colors shrink-0 ${
              activeSkill === chip.id
                ? 'bg-[#DA7756] text-white'
                : 'bg-[#1A1A1A] text-[#A0A0A0] hover:text-[var(--text-primary)] border border-[#2A2A2A] hover:border-[#DA7756]/40'
            }`}
          >
            <span>{chip.icon}</span>
            {chip.label}
          </button>
        ))}
        {activeSkill && (
          <button
            onClick={() => setActiveSkill(null)}
            className="ml-auto shrink-0 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Active skill indicator */}
      {activeSkillData && (
        <div className="px-6 py-1.5 bg-[#DA7756]/5 border-b border-[#DA7756]/20 flex items-center gap-2">
          <span className="text-[10px] text-[#DA7756]">
            {activeSkillData.icon} Using <strong>{activeSkillData.label}</strong> skill framework
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 bg-[#DA7756]/20 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-[#DA7756] text-xl font-bold">M</span>
            </div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">What can I help with today?</h2>
            <p className="text-sm text-[#555] mb-8">Your AI marketing OS. Pick a skill above or ask anything below.</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {QUICK_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-full text-xs text-[#A0A0A0] hover:text-[var(--text-primary)] hover:border-[#DA7756]/50 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}

        {streaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <ToolCallIndicator tool="Thinking…" />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3 border-t border-[#1E1E1E]">
        <div className="flex gap-3 items-end bg-[#111] border border-[#2A2A2A] rounded-xl p-3 focus-within:border-[#DA7756]/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeSkillData ? `Ask ${activeSkillData.label} expert anything…` : 'Ask Marvyn anything…'}
            rows={1}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none outline-none max-h-32 overflow-y-auto"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            loading={loading}
            size="sm"
            className="shrink-0"
          >
            Send
          </Button>
        </div>
        <p className="text-[10px] text-[#333] mt-2 text-center">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
  )
}
