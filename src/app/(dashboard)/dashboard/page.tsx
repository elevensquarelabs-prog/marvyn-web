'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatWindow, type ChatMessage } from '@/components/chat/ChatWindow'

interface SessionSummary {
  _id: string
  title: string
  updatedAt: string
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function ChatPage() {
  const [agentStatus, setAgentStatus] = useState('idle')
  const [activeTool, setActiveTool] = useState<string | null>(null)

  // Sessions
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/sessions')
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  async function loadSession(sessionId: string) {
    if (sessionId === activeSessionId) return
    setLoadingSession(true)
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`)
      const data = await res.json()
      const msgs: ChatMessage[] = (data.session?.messages ?? []).map((m: { role: 'user' | 'assistant'; content: string; createdAt?: string }) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))
      setActiveMessages(msgs)
      setActiveSessionId(sessionId)
    } finally {
      setLoadingSession(false)
    }
  }

  function startNewChat() {
    setActiveSessionId(null)
    setActiveMessages([])
  }

  function handleSessionCreated(sessionId: string, title: string) {
    setActiveSessionId(sessionId)
    // Add to top of session list
    setSessions(prev => {
      const exists = prev.find(s => s._id === sessionId)
      if (exists) return prev
      return [{ _id: sessionId, title, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }, ...prev]
    })
  }

  async function deleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s._id !== sessionId))
    if (activeSessionId === sessionId) startNewChat()
  }

  const handleStatusChange = (status: string, tool?: string) => {
    setAgentStatus(status)
    setActiveTool(tool || null)
    // Refresh sessions list when done to update titles
    if (status === 'idle') fetchSessions()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1E1E1E] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="text-[#555] hover:text-[#A0A0A0] transition-colors p-1 rounded"
            title={sidebarOpen ? 'Hide history' : 'Show history'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="1" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="0" y="6.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
              <rect x="0" y="11.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
            </svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white">Chat</h1>
            <p className="text-xs text-[#555]">AI marketing assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {agentStatus === 'running' && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#DA7756] rounded-full animate-pulse" />
              <span className="text-xs text-[#DA7756]">{activeTool || 'Running…'}</span>
            </div>
          )}
          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A0A0A0] hover:text-white border border-[#2A2A2A] hover:border-[#DA7756]/40 rounded-lg transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Chat
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* History sidebar */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 border-r border-[#1E1E1E] flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[#1E1E1E]">
              <p className="text-[10px] text-[#444] font-medium uppercase tracking-wider">History</p>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {sessionsLoading && (
                <div className="space-y-1 p-2 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 bg-[#111] rounded-lg" />
                  ))}
                </div>
              )}
              {!sessionsLoading && sessions.length === 0 && (
                <p className="text-[11px] text-[#444] px-3 py-4 text-center">No conversations yet</p>
              )}
              {sessions.map(s => (
                <div
                  key={s._id}
                  onClick={() => loadSession(s._id)}
                  className={`group relative mx-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeSessionId === s._id
                      ? 'bg-[#DA7756]/10 border border-[#DA7756]/20'
                      : 'hover:bg-[#1A1A1A]'
                  }`}
                >
                  <p className={`text-xs truncate pr-5 ${activeSessionId === s._id ? 'text-white' : 'text-[#A0A0A0]'}`}>
                    {s.title || 'New Chat'}
                  </p>
                  <p className="text-[10px] text-[#444] mt-0.5">{timeAgo(s.updatedAt)}</p>
                  <button
                    onClick={(e) => deleteSession(s._id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all p-1"
                    title="Delete"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-hidden relative">
          {loadingSession ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2 text-[#555]">
                <span className="w-1.5 h-1.5 bg-[#DA7756] rounded-full animate-pulse" />
                <span className="text-xs">Loading conversation…</span>
              </div>
            </div>
          ) : (
            <ChatWindow
              key={activeSessionId ?? 'new'}
              onAgentStatusChange={handleStatusChange}
              initialSessionId={activeSessionId}
              initialMessages={activeMessages}
              onSessionCreated={handleSessionCreated}
            />
          )}
        </div>
      </div>
    </div>
  )
}
