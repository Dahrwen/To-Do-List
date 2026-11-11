/**
 * ============================================================================
 * FILE: src/components/TaskDetailsModal/TaskDetailsModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Top-layer React Portal modal dialog (`createPortal` to `document.body`)
 *   displaying the complete details of a selected task in an expanded,
 *   spacious container (`min(90vw, 720px)`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Top-Most Layering via React Portal:
 *      Renders directly into `document.body` at `z-index: 9999` with a blurred
 *      backdrop overlay so it never collides with sticky toolbars, weekday
 *      tracker cards, or the floating pagination pill.
 *   2. Adaptive Title Typography:
 *      Dynamically scales the task title font size based on character length:
 *      - `<= 30 chars`: `.modal-title-lg`
 *      - `31 - 60 chars`: `.modal-title-md`
 *      - `> 60 chars`: `.modal-title-sm`
 *   3. Google Classroom Deadline Lock Indicator:
 *      When `task.source === 'google_classroom'`, renders the deadline with
 *      the Google Classroom badge and an immutable lock badge (`Managed by
 *      Google Classroom`).
 *   4. Non-Overlapping Flex Footer Actions:
 *      Renders `Edit`, `Finish` / `Restore`, and `Delete` inside a dedicated
 *      static footer bar so buttons never overlap the description text.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library, `useEffect`
 *   - 'react-dom': `createPortal`
 *   - './TaskDetailsModal.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/TaskDetailsModal/index.js`
 *   - `src/App.jsx`: Default export `TaskDetailsModal`, named export `getAdaptiveTitleClass`
 * ============================================================================
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './TaskDetailsModal.css';

/**
 * Computes the adaptive typography class for a task title based on character count.
 * - <= 30 chars: 'modal-title-lg'
 * - 31..60 chars: 'modal-title-md'
 * - > 60 chars: 'modal-title-sm'
 *
 * @param {string} title
 * @returns {string} CSS class name
 */
export const getAdaptiveTitleClass = (title = '') => {
  const len = String(title).trim().length;
  if (len <= 30) return 'modal-title-lg';
  if (len <= 60) return 'modal-title-md';
  return 'modal-title-sm';
};

/**
 * TaskDetailsModal Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Object|null} props.task - Selected task object
 * @param {Function} props.onClose - Callback to dismiss the modal
 * @param {Function} props.onFinish - Callback `(taskId) => void` to toggle completion
 * @param {Function} props.onEdit - Callback `(task) => void` to open EditTaskModal
 * @param {Function} props.onDelete - Callback `(taskId) => void` to delete the task
 */
export default function TaskDetailsModal({
  isOpen,
  task,
  onClose,
  onFinish,
  onEdit,
  onDelete,
}) {
  // Allow dismissing modal with the Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task || typeof document === 'undefined') return null;

  const taskTitle = task.TaskName || task.name || 'Untitled Task';
  const titleSizeClass = getAdaptiveTitleClass(taskTitle);
  const categories = task.categories || [];
  const description = !task.Description
    ? 'Edit to add description'
    : task.Description;

  const isGoogleClassroom =
    task.source === 'google_classroom' ||
    Boolean(task.Description && task.Description.includes('[Google Classroom]'));

  const formatDeadlineDisplay = (t) => {
    if (t.deadLine && t.deadLine !== 'No due date') return t.deadLine;
    if (!t.Deadline) return 'No Due Date';
    const d = new Date(t.Deadline);
    if (isNaN(d.getTime())) return t.Deadline;
    const datePart = d.toDateString().split(' ').slice(1).join(' ');
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} • ${timePart}`;
  };

  const deadline = formatDeadlineDisplay(task);
  const finishBtnLabel = task.finished ? 'Restore' : 'Finish';

  return createPortal(
    <div
      className="modal-portal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-details-heading"
    >
      <section
        className="popUpDesc activeDesc modal-wide-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (X) */}
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close task details"
        >
          &times;
        </button>

        {/* Compact Modal Header */}
        <header className="modal-header-block">
          <span className="modal-eyebrow-label">Task Details</span>
          <h1 id="task-details-heading" className={`modal-adaptive-title ${titleSizeClass}`}>
            {taskTitle}
          </h1>
        </header>

        {/* Scrollable Modal Body */}
        <div id="taskDesc" className="modal-body-scroll">
          <div className="modal-meta-grid">
            {/* Categories Field */}
            <div className="modal-field-group">
              <span className="modal-field-label">Categories</span>
              {categories.length > 0 ? (
                <ul className="modal-category-pills">
                  {categories.map((cat, idx) => (
                    <li key={idx} className={cat}>
                      {cat}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="modal-field-value-muted">Uncategorized</span>
              )}
            </div>

            {/* Deadline Field (with Google Classroom immutable lock badge when applicable) */}
            <div className="modal-field-group">
              <span className="modal-field-label">Deadline</span>
              <div className="modal-deadline-row">
                <span className="modal-deadline-text">{deadline}</span>
                {isGoogleClassroom && (
                  <span
                    className="classroom-lock-badge"
                    title="Deadline managed by Google Classroom (Read-Only)"
                  >
                    <img
                      src="/Pictures/GoogleClassroom.svg"
                      alt="Google Classroom"
                      className="classroom-badge-icon"
                    />
                    <i className="fa-solid fa-lock" aria-hidden="true"></i>
                    <span>Managed by Classroom</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description Field */}
          <div className="modal-field-group">
            <span className="modal-field-label">Task Description</span>
            <div className="modal-description-box">{description}</div>
          </div>
        </div>

        {/* Dedicated Non-Overlapping Footer Actions */}
        <footer className="modal-footer-bar">
          <div className="modal-footer-left">
            <button
              className="eButton modal-action-btn"
              id="editButton"
              type="button"
              onClick={() => onEdit(task)}
            >
              Edit
            </button>

            <button
              className="fButton modal-action-btn"
              id="finishButton"
              type="button"
              onClick={() => onFinish(task.id)}
            >
              {finishBtnLabel}
            </button>
          </div>

          <button
            type="button"
            className="modal-delete-btn"
            onClick={() => onDelete(task.id)}
            title="Delete task"
            aria-label="Delete task"
          >
            <img
              id="delete"
              src="/Pictures/TrashCan.png"
              alt="Delete"
            />
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
