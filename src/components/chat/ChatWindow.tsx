'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageBubble } from './MessageBubble'
import { ToolCallIndicator } from './ToolCallIndicator'
import { Button } from '@/components/shared/Button'
import {
  AGENT_MENTIONS,
  getActiveRunAgent,
  getMentionMatches,
  getSelectedMention,
} from './mention-ui'

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
  const [toolLabel, setToolLabel] = useState<string | null>(null)
  const [completedSteps, setCompletedSteps] = useState<{ text: string; isError: boolean }[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [activeRunAgent, setActiveRunAgent] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)

  const mentionMatches = getMentionMatches(mentionQuery)
  const selectedMention = getSelectedMention(input)
  const runningMention = AGENT_MENTIONS.find(agent => agent.name === activeRunAgent) ?? null

  // Reset when switching sessions
  useEffect(() => {
    const nextSessionId = initialSessionId ?? null
    const currentSessionId = sessionId ?? null
    const nextMessages = initialMessages ?? []

    // First message creates a real session id after send. Keep local streamed
    // state instead of replacing it with still-empty parent props.
    if (nextSessionId && nextSessionId !== currentSessionId) {
      const isLoadedSessionSwitch = nextMessages.length > 0
      if (isLoadedSessionSwitch) {
        setMessages(nextMessages)
      }
      setSessionId(nextSessionId)
      return
    }

    // Starting a brand-new chat from the parent should clear the local thread.
    if (!nextSessionId && currentSessionId) {
      setMessages([])
      setSessionId(null)
      return
    }

    // Initial hydration for preloaded messages.
    if (!currentSessionId && !nextSessionId && nextMessages.length > 0) {
      setMessages(nextMessages)
    }
  }, [initialSessionId, initialMessages, sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string, skillOverride?: string) => {
    if (!text.trim() || loading) return

    const skill = skillOverride ?? activeSkill
    const selectedBeforeSend = getSelectedMention(text)
    const userMsg: ChatMessage = { role: 'user', content: text, createdAt: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setStreaming(true)
    setToolLabel(null)
    setCompletedSteps([])
    setActiveRunAgent(selectedBeforeSend?.name ?? null)
    onAgentStatusChange?.('running', 'Thinking…')

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, skillId: skill }),
      })

      if (!res.ok) {
        let errMsg = 'Something went wrong. Please try again.'
        try { const d = await res.json(); if (d.error) errMsg = d.error } catch {}
        throw new Error(errMsg)
      }
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
            } else if (data.type === 'agent_status') {
              const label = data.message ? `${data.agent}: ${data.message}` : data.agent
              setToolLabel(label)
              setActiveRunAgent(prev => getActiveRunAgent(label) ?? prev)
              onAgentStatusChange?.('running', label)
            } else if (data.type === 'agent_start') {
              const agentLabel = (data.agent as string).charAt(0).toUpperCase() + (data.agent as string).slice(1)
              setActiveRunAgent(getActiveRunAgent(agentLabel))
              setToolLabel(`${agentLabel} agent running…`)
              onAgentStatusChange?.('running', `${agentLabel} agent running…`)
            } else if (data.type === 'agent_done') {
              const agentLabel = (data.agent as string).charAt(0).toUpperCase() + (data.agent as string).slice(1)
              setCompletedSteps(prev => [...prev, { text: `${agentLabel} analysis complete`, isError: false }])
              setToolLabel(null)
            } else if (data.type === 'agent_error') {
              const agentLabel = (data.agent as string).charAt(0).toUpperCase() + (data.agent as string).slice(1)
              setCompletedSteps(prev => [...prev, { text: `${agentLabel}: ${data.error ?? 'failed'}`, isError: true }])
              setToolLabel(null)
            } else if (data.type === 'tool_call') {
              setToolLabel(data.label || data.tool)
              onAgentStatusChange?.('running', data.label)
            } else if (data.type === 'tool_result') {
              setCompletedSteps(prev => [...prev, { text: data.summary, isError: false }])
              setToolLabel(null)
            } else if (data.type === 'delta') {
              setToolLabel(null)
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
              setToolLabel(null)
              setCompletedSteps([])
              setActiveRunAgent(null)
              onAgentStatusChange?.('idle')
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      console.error(err)
      const fallback = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: fallback }])
      setActiveRunAgent(null)
      onAgentStatusChange?.('idle')
    } finally {
      setLoading(false)
      setStreaming(false)
      setToolLabel(null)
      setCompletedSteps([])
      if (!streaming) setActiveRunAgent(null)
    }
  }, [loading, sessionId, activeSkill, messages.length, onAgentStatusChange, onSessionCreated, streaming])

  const insertMention = useCallback((agentName: string) => {
    // Replace the trailing @query with @agentName followed by a space
    const atIdx = input.lastIndexOf('@')
    const newInput = input.slice(0, atIdx) + `@${agentName} `
    setInput(newInput)
    setMentionQuery(null)
    setMentionIndex(0)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(i => (i + 1) % mentionMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionMatches[mentionIndex].name)
        return
      }
      if (e.key === 'Escape') {
        setMentionQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    // Detect @mention trigger
    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1) {
      const afterAt = val.slice(atIdx + 1)
      // Only show picker if there's no space after the @ (still typing the mention)
      if (!afterAt.includes(' ')) {
        setMentionQuery(afterAt.toLowerCase())
        setMentionIndex(0)
        return
      }
    }
    setMentionQuery(null)
  }

  const activateSkill = (chip: typeof SKILL_CHIPS[0]) => {
    if (activeSkill === chip.id) {
      setActiveSkill(null)
    } else {
      setActiveSkill(chip.id)
      if (!input.trim()) setInput(chip.prompt)
      textareaRef.current?.focus()
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

        {/* Completed tool calls shown as subtle pills */}
        {completedSteps.length > 0 && (
          <div className="flex flex-col gap-1 mb-2 ml-10">
            {completedSteps.map((step, i) => (
              <div
                key={i}
                className={`flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 ${
                  step.isError
                    ? 'border-[#4A1F1D] bg-[#261312]'
                    : 'border-[#1E3A1E] bg-[#0F1A0F]'
                }`}
              >
                {step.isError ? (
                  <svg className="h-3 w-3 shrink-0 text-[#F08E7D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86l-7.5 13A1 1 0 003.66 18h16.68a1 1 0 00.87-1.5l-7.5-13a1 1 0 00-1.74 0z"/></svg>
                ) : (
                  <svg className="h-3 w-3 shrink-0 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                )}
                <span className={`text-[11px] ${step.isError ? 'text-[#F6B1A6]' : 'text-green-400'}`}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Active tool call spinner */}
        {toolLabel && <ToolCallIndicator tool={toolLabel} />}

        {/* Initial thinking state (before first tool or delta) */}
        {streaming && !toolLabel && completedSteps.length === 0 && messages[messages.length - 1]?.role !== 'assistant' && (
          <ToolCallIndicator tool="Thinking…" />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3 border-t border-[#1E1E1E]">
        {/* @mention picker */}
        {mentionQuery !== null && mentionMatches.length > 0 && (
          <div ref={mentionRef} className="mb-3 overflow-hidden rounded-2xl border border-[#E8D7CF] bg-[#FFF9F6] shadow-[0_18px_40px_rgba(25,12,8,0.08)]">
            {mentionMatches.map((agent, idx) => (
              <button
                key={agent.name}
                onMouseDown={e => { e.preventDefault(); insertMention(agent.name) }}
                className={`group relative w-full px-4 py-3 text-left transition-colors ${idx === mentionIndex ? 'bg-[#FFF1EA]' : 'hover:bg-[#FFF5F1]'}`}
              >
                <div className={`absolute inset-y-2 left-2 w-1 rounded-full ${idx === mentionIndex ? 'bg-[#DA7756]' : 'bg-transparent group-hover:bg-[#F1B59B]'}`} />
                <div className="flex items-start gap-3 pl-3">
                  <span className={`mt-0.5 rounded-full px-2 py-1 font-mono text-[11px] ${idx === mentionIndex ? 'bg-[#DA7756] text-white' : 'bg-[#F6E4DB] text-[#B05B37]'}`}>@{agent.name}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#2A1B15]">{agent.label}</div>
                    <div className="mt-0.5 text-xs text-[#7C6258]">{agent.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {(selectedMention || runningMention) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedMention && (
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                runningMention?.name === selectedMention.name
                  ? 'border-[#DA7756] bg-[#FFF1EA] text-[#8A4729] shadow-[0_0_0_3px_rgba(218,119,86,0.12)]'
                  : 'border-[#E8D7CF] bg-[#FFF8F3] text-[#6F564C]'
              }`}>
                <span className={`h-2 w-2 rounded-full ${runningMention?.name === selectedMention.name ? 'bg-[#DA7756] animate-pulse' : 'bg-[#D4A28A]'}`} />
                <span className="font-medium">{selectedMention.label}</span>
                <span className="text-[#9A7A6C]">{runningMention?.name === selectedMention.name ? 'Working now' : 'Selected'}</span>
              </div>
            )}
            {runningMention && runningMention.name !== selectedMention?.name && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DA7756] bg-[#FFF1EA] px-3 py-1.5 text-xs text-[#8A4729] shadow-[0_0_0_3px_rgba(218,119,86,0.12)]">
                <span className="h-2 w-2 rounded-full bg-[#DA7756] animate-pulse" />
                <span className="font-medium">{runningMention.label}</span>
                <span className="text-[#9A7A6C]">Working now</span>
              </div>
            )}
          </div>
        )}
        <div className={`flex gap-3 items-end rounded-xl border p-3 transition-colors ${
          runningMention
            ? 'border-[#DA7756]/60 bg-[#FFF7F3] shadow-[0_0_0_4px_rgba(218,119,86,0.08)]'
            : selectedMention
              ? 'border-[#E5C6B8] bg-[#FFF9F6]'
              : 'bg-[#111] border-[#2A2A2A] focus-within:border-[#DA7756]/50'
        }`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={activeSkillData ? `Ask ${activeSkillData.label} expert anything…` : 'Ask Marvyn anything…'}
            rows={1}
            disabled={loading}
            className={`flex-1 resize-none bg-transparent text-sm outline-none max-h-32 overflow-y-auto ${
              selectedMention || runningMention
                ? 'text-[#2A1B15] placeholder-[#9A7A6C]'
                : 'text-[var(--text-primary)] placeholder-[var(--text-muted)]'
            }`}
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
