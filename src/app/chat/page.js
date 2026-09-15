"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);

  const messagesEndRef = useRef(null);
  const { user, loading: authLoading, signOut, getAccessToken } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch conversations list
  const fetchConversations = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("/api/chat/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch conversations");
      }

      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError("Failed to load conversations. Please refresh.");
    } finally {
      setLoadingConversations(false);
    }
  }, [getAccessToken, router]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // Load a conversation's messages
  const loadConversation = useCallback(
    async (conversationId) => {
      const token = getAccessToken();
      if (!token) return;

      setActiveConversationId(conversationId);
      setMessages([]);
      setError("");
      setIsSidebarOpen(false);

      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error("Failed to load conversation");
        }

        const data = await res.json();
        setMessages(data.conversation?.messages || []);
      } catch (err) {
        console.error("Error loading conversation:", err);
        setError("Failed to load this conversation.");
      }
    },
    [getAccessToken, router]
  );

  // Start a new chat
  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setError("");
    setIsSidebarOpen(false);
  };

  // Delete a conversation
  const handleDeleteConversation = async (conversationId) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete conversation");

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Error deleting conversation:", err);
      setError("Failed to delete conversation.");
    }
  };

  // Send a message
  const handleSendMessage = async (messageText) => {
    if (isLoading) return;

    setError("");
    setIsLoading(true);

    // Optimistically add user message
    const userMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const token = getAccessToken();
    if (!token) {
      setError("Session expired. Please sign in again.");
      setIsLoading(false);
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: messageText,
          conversationId: activeConversationId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();

      // Update conversation ID if this was a new conversation
      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId);
        // Refresh conversations list to show the new one
        fetchConversations();
      }

      // Add AI response
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "model",
          content: data.message.content,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err.message || "Failed to send message. Please try again.");
      // Remove the optimistically added user message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/login");
    } catch (err) {
      console.error("Error signing out:", err);
      setError("Failed to sign out.");
    }
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="chat-page__loader">
        <div className="chat-page__loader-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="chat-page">
      {/* Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={loadConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main chat area */}
      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <div className="chat-header__left">
            <button
              className="chat-header__menu"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              id="sidebar-toggle"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="chat-header__title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Gemini Chat
            </div>
          </div>
          <div className="chat-header__right">
            <span className="chat-header__email">{user.email}</span>
            <button className="chat-header__signout" onClick={handleSignOut} id="signout-button">
              Sign Out
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="chat-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
            <button onClick={() => setError("")} className="chat-error__close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Messages area */}
        <div className="chat-messages">
          {messages.length === 0 && !isLoading ? (
            <div className="chat-empty">
              <div className="chat-empty__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h2 className="chat-empty__title">How can I help you today?</h2>
              <p className="chat-empty__subtitle">
                Start a conversation with Bluu AI. Ask questions, generate code, analyze data, and more.
              </p>
              <div className="chat-empty__suggestions">
                {[
                  "Explain quantum computing in simple terms",
                  "Write a Python function to sort a list",
                  "What are the best practices for REST APIs?",
                  "Help me debug this JavaScript error",
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    className="chat-empty__suggestion"
                    onClick={() => handleSendMessage(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {isLoading && (
                <div className="chat-message chat-message--ai">
                  <div className="chat-message__avatar chat-message__avatar--ai">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  </div>
                  <div className="chat-message__body">
                    <div className="chat-message__role">Bluu AI</div>
                    <div className="chat-message__typing">
                      <span className="chat-message__typing-dot" />
                      <span className="chat-message__typing-dot" />
                      <span className="chat-message__typing-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
}
