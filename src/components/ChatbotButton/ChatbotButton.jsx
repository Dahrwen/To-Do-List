/**
 * ============================================================================
 * COMPONENT: ChatbotButton
 * FILE: src/components/ChatbotButton/ChatbotButton.jsx
 * ============================================================================
 * PURPOSE:
 *   Floating circular placeholder button anchored to the bottom-left corner
 *   of the dashboard for future AI chatbot implementation.
 * ============================================================================
 */

import React from 'react';
import './ChatbotButton.css';

/**
 * ChatbotButton Component (Placeholder)
 */
export function ChatbotButton({ onClick }) {
  return (
    <button
      type="button"
      className="chatbot-floating-btn"
      onClick={onClick}
      aria-label="AI Assistant (Coming Soon)"
      title="AI Assistant (Coming Soon)"
    >
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
    </button>
  );
}

export default ChatbotButton;
