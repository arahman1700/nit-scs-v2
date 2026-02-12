import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAiChat, useAiConversations, useAiConversation } from './hooks/useAiChat';
import type { AiMessage } from './hooks/useAiChat';
import { MessageCircle, X, Send, Loader2, Trash2, ChevronLeft, Plus } from 'lucide-react';

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<AiMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useAiChat();
  const { data: conversationsData } = useAiConversations();
  const { data: convData } = useAiConversation(conversationId);

  const conversations = (conversationsData as unknown as { data?: unknown[] })?.data ?? [];
  const loadedMessages = (convData as unknown as { data?: { messages?: AiMessage[] } })?.data?.messages ?? [];

  // Merge loaded messages with optimistic local ones
  const allMessages = conversationId ? loadedMessages : localMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMsg: AiMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };

    setLocalMessages(prev => [...prev, userMsg]);
    setInput('');

    try {
      const result = await chatMutation.mutateAsync({
        conversationId,
        message: userMsg.content,
      });

      const data = (result as unknown as { data?: { conversationId?: string; message?: AiMessage } })?.data;
      if (data?.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
      if (data?.message) {
        setLocalMessages(prev => [...prev, data.message!]);
      }
    } catch {
      setLocalMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong.',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }, [input, chatMutation, conversationId]);

  const handleNewConversation = useCallback(() => {
    setConversationId(undefined);
    setLocalMessages([]);
    setShowHistory(false);
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setConversationId(id);
    setLocalMessages([]);
    setShowHistory(false);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 end-6 z-50 w-14 h-14 rounded-full bg-nesma-primary shadow-lg shadow-nesma-primary/30 flex items-center justify-center hover:scale-110 transition-all duration-300"
        aria-label="Open AI Chat"
      >
        <MessageCircle size={24} className="text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 end-6 z-50 w-96 h-[32rem] glass-panel rounded-2xl border border-white/10 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {showHistory && (
            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-white/10 rounded-lg">
              <ChevronLeft size={16} className="text-gray-400" />
            </button>
          )}
          <MessageCircle size={18} className="text-nesma-secondary" />
          <span className="text-sm font-medium text-white">{showHistory ? 'Conversations' : 'AI Assistant'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewConversation}
            className="p-1.5 hover:bg-white/10 rounded-lg"
            aria-label="New conversation"
          >
            <Plus size={14} className="text-gray-400" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1.5 hover:bg-white/10 rounded-lg"
            aria-label="History"
          >
            <Trash2 size={14} className="text-gray-400" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg" aria-label="Close">
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {showHistory ? (
        /* Conversation History */
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {(conversations as Array<{ id: string; title?: string; _count?: { messages: number } }>).map(conv => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className="w-full text-start glass-card rounded-xl p-3 hover:bg-white/10 transition-all"
            >
              <p className="text-sm text-white truncate">{conv.title || 'Untitled'}</p>
              <p className="text-xs text-gray-500">{conv._count?.messages ?? 0} messages</p>
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="text-gray-500 text-sm text-center pt-10">No conversations yet</p>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {allMessages.length === 0 && (
              <div className="text-center pt-10">
                <MessageCircle size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Ask me anything about your supply chain data.</p>
                <p className="text-xs text-gray-600 mt-2">e.g., "How many GRNs were created this month?"</p>
              </div>
            )}
            {allMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user' ? 'bg-nesma-primary text-white' : 'bg-white/5 text-gray-300'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.generatedQuery && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">SQL Query</summary>
                      <pre className="text-xs bg-black/30 rounded p-2 mt-1 overflow-x-auto">{msg.generatedQuery}</pre>
                    </details>
                  )}
                  {msg.resultData != null && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">Raw Data</summary>
                      <pre className="text-xs bg-black/30 rounded p-2 mt-1 max-h-32 overflow-auto">
                        {JSON.stringify(msg.resultData, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-white/5 rounded-xl px-3 py-2">
                  <Loader2 size={16} className="animate-spin text-nesma-secondary" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Ask a question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={chatMutation.isPending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="p-2.5 bg-nesma-primary rounded-lg hover:bg-nesma-primary/80 transition-all disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
