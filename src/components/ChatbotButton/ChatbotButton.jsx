/**
 * ============================================================================
 * COMPONENT: ChatbotButton
 * FILE: src/components/ChatbotButton/ChatbotButton.jsx
 * ============================================================================
 * PURPOSE:
 *   Floating lower-right AI assistant toggle bubble and expandable chat panel.
 *   Uses `/Pictures/ROBOT.svg` avatar, speech-tail bubbles, `"..."` loading
 *   indicator, and auto-inserts parsed tasks into Supabase.
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import { parseAndInsertAnnouncementTasks } from '../../services/geminiTaskService';
import './ChatbotButton.css';

const INITIAL_GREETING = {
  id: 'welcome-msg',
  role: 'assistant',
  text: 'Paste school announcements, class reminders, or assignment post; I will extract the tasks and add them to your list.',
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
          aria-label="AI Task Creator"
        >
          <header className="chatbot-panel-header">
            <div className="chatbot-header-title">
              <span className="chatbot-header-badge">
                <img
                  src="/Pictures/ROBOT.svg"
                  alt="AI Robot"
                  className="chatbot-robot-img"
                />
              </span>
              <div className="chatbot-header-copy">
                <h2>AI Task Creator</h2>
                <span className="chatbot-header-subtitle">
                  Task Creator Assistant
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
            {messages.map((msg) =>
              msg.role === 'assistant' ? (
                <div key={msg.id} className="chatbot-assistant-row">
                  <span className="chatbot-msg-avatar" aria-hidden="true">
                    <img
                      src="/Pictures/ROBOT.svg"
                      alt=""
                      className="chatbot-robot-img"
                    />
                  </span>
                  <div
                    className={`chatbot-msg chatbot-msg-assistant chatbot-speech-bubble ${
                      msg.isError ? 'chatbot-msg-error' : ''
                    }`}
                  >
                    <p className="chatbot-msg-text">{msg.text}</p>

                    {msg.insertedTasks && msg.insertedTasks.length > 0 && (
                      <ul className="chatbot-added-tasks-list">
                        {msg.insertedTasks.map((task) => (
                          <li key={task.id} className="chatbot-added-task-card">
                            <div className="chatbot-task-card-top">
                              <strong className="chatbot-task-title">
                                {task.title}
                              </strong>
                              <span className="chatbot-task-status-pill">
                                Added ✓
                              </span>
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
                </div>
              ) : (
                <div key={msg.id} className="chatbot-msg chatbot-msg-user">
                  <p className="chatbot-msg-text">{msg.text}</p>
                </div>
              )
            )}

            {isLoading && (
              <div className="chatbot-assistant-row">
                <span className="chatbot-msg-avatar" aria-hidden="true">
                  <img
                    src="/Pictures/ROBOT.svg"
                    alt=""
                    className="chatbot-robot-img"
                  />
                </span>
                <div
                  className="chatbot-msg chatbot-msg-assistant chatbot-speech-bubble chatbot-msg-loading"
                  aria-label="Thinking"
                >
                  <span className="chatbot-typing-ellipsis" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-bar" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              className="chatbot-textarea"
              rows={1}
              placeholder="Type a message"
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
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22 11 13 2 9z" />
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
        aria-label={isOpen ? 'Close AI Task Creator' : 'Open AI Task Creator'}
        title="AI Task Creator"
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
          <img
            src="/Pictures/ROBOT.svg"
            alt="AI Assistant"
            className="chatbot-toggle-robot-img"
          />
        )}
      </button>
    </div>
  );
}

export default ChatbotButton;
