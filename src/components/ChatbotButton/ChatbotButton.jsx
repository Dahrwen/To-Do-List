/**
 * ============================================================================
 * COMPONENT: ChatbotButton
 * FILE: src/components/ChatbotButton/ChatbotButton.jsx
 * ============================================================================
 * PURPOSE:
 *   Floating lower-right AI assistant toggle bubble and expandable chat panel.
 *   Accepts raw school announcements or general questions, calls the server-side
 *   Gemini parser (`parseAndInsertAnnouncementTasks`), auto-inserts extracted
 *   tasks into Supabase for the authenticated user, and renders confirmation cards.
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { parseAndInsertAnnouncementTasks } from '../../services/geminiTaskService';
import './ChatbotButton.css';

const INITIAL_GREETING = {
  id: 'welcome-msg',
  role: 'assistant',
  text: 'Paste any school announcement, class reminder, or assignment post below — I will extract tasks and deadlines and add them straight to your To-Do List.',
  insertedTasks: [],
  isError: false,
};

/**
 * ChatbotButton Component
 *
 * @param {Object} props
 * @param {Object|null} props.currentUser - Authenticated user object containing `userID`
 * @param {Function} props.onTasksAdded - Callback invoked after new tasks are saved to refresh lists
 */
export function ChatbotButton({ currentUser = null, onTasksAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([INITIAL_GREETING]);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
      insertedTasks: [],
      isError: false,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await parseAndInsertAnnouncementTasks({
        message: trimmed,
        userId: currentUser?.userID,
      });

      const assistantMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: result.reply,
        insertedTasks: result.insertedTasks || [],
        isError: false,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (result.insertedTasks?.length > 0 && typeof onTasksAdded === 'function') {
        onTasksAdded(result.insertedTasks);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            err?.message ||
            'Something went wrong while analyzing your announcement. Please try again.',
          insertedTasks: [],
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClearChat = () => {
    if (isLoading) return;
    setMessages([INITIAL_GREETING]);
  };

  return (
    <div className="chatbot-widget-root">
      {isOpen && (
        <section
          className="chatbot-panel"
          role="dialog"
          aria-label="AI Announcement Assistant"
        >
          <header className="chatbot-panel-header">
            <div className="chatbot-header-title">
              <span className="chatbot-header-badge" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              </span>
              <div>
                <h2>AI Task Assistant</h2>
                <span className="chatbot-header-subtitle">
                  Paste announcements to auto-add tasks
                </span>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-clear-btn"
                onClick={handleClearChat}
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                Clear
              </button>
              <button
                type="button"
                className="chatbot-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close assistant"
                aria-label="Close assistant"
              >
                &times;
              </button>
            </div>
          </header>

          <div className="chatbot-messages" role="log" aria-live="polite">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chatbot-msg chatbot-msg-${msg.role} ${
                  msg.isError ? 'chatbot-msg-error' : ''
                }`}
              >
                <p className="chatbot-msg-text">{msg.text}</p>

                {msg.insertedTasks && msg.insertedTasks.length > 0 && (
                  <ul className="chatbot-added-tasks-list">
                    {msg.insertedTasks.map((task) => (
                      <li key={task.id} className="chatbot-added-task-card">
                        <div className="chatbot-task-card-top">
                          <strong className="chatbot-task-title">{task.title}</strong>
                          <span className="chatbot-task-status-pill">Added ✓</span>
                        </div>
                        <div className="chatbot-task-card-meta">
                          <span className="chatbot-task-category">
                            {task.category}
                          </span>
                          <span className="chatbot-task-deadline">
                            {task.deadlineDisplay}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="chatbot-msg chatbot-msg-assistant chatbot-msg-loading">
                <span className="chatbot-typing-dots" aria-label="Analyzing announcement">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span className="chatbot-loading-label">
                  Extracting tasks & deadlines...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-bar" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="chatbot-textarea"
              rows={2}
              placeholder="Paste a school announcement or ask anything..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!inputText.trim() || isLoading}
              aria-label="Send message"
              title="Send (Enter)"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`chatbot-floating-btn ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        title="AI Announcement Assistant"
      >
        {isOpen ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default ChatbotButton;
