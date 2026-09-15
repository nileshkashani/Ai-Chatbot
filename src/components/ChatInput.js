"use client";

import { useState, useRef, useEffect } from "react";

export default function ChatInput({ onSend, isLoading }) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
    }
  }, [message]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    onSend(message.trim());
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="chat-input__wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input__textarea"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Gemini AI..."
          rows={1}
          disabled={isLoading}
          id="chat-input-textarea"
        />
        <button
          type="submit"
          className={`chat-input__send ${
            message.trim() && !isLoading ? "chat-input__send--active" : ""
          }`}
          disabled={!message.trim() || isLoading}
          id="chat-send-button"
        >
          {isLoading ? (
            <div className="chat-input__spinner" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      <div className="chat-input__hint">
        Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
      </div>
    </form>
  );
}
