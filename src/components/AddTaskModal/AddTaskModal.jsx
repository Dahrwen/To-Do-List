/**
 * ============================================================================
 * FILE: src/components/AddTaskModal/AddTaskModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Top-layer React Portal modal dialog (`createPortal` to `document.body`)
 *   allowing the user to create a new manual task with a name, up to 6
 *   category tags (`Type1`..`Type6`), and an optional deadline date + time
 *   (`timestamptz`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Top-Most Layering via React Portal:
 *      Renders directly into `document.body` at `z-index: 9999` with a full
 *      backdrop overlay.
 *   2. Controlled Form State & ISO `timestamptz` Serialization:
 *      Combines the local date and time inputs (`new Date("${deadline}T${timePart}:00")`)
 *      and converts them to an ISO-8601 UTC string (`.toISOString()`) for
 *      storage in Supabase's `timestamptz` `Deadline` column.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useEffect`
 *   - 'react-dom': `createPortal`
 *   - './AddTaskModal.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/AddTaskModal/index.js`
 *   - `src/App.jsx`: Default export `AddTaskModal`
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './AddTaskModal.css';

// Definitions for the 6 task category options matching the database boolean columns (Type1 to Type6)
const taskTypes = [
  { id: 'type1', key: 'Type1', label: 'Personal' },
  { id: 'type2', key: 'Type2', label: 'Urgent' },
  { id: 'type3', key: 'Type3', label: 'Growth' },
  { id: 'type4', key: 'Type4', label: 'Academics' },
  { id: 'type5', key: 'Type5', label: 'Interactive' },
  { id: 'type6', key: 'Type6', label: 'Social' },
];

/**
 * AddTaskModal Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onAddTask - Async callback `(newTaskData) => Promise<void>`
 */
export default function AddTaskModal({ isOpen, onClose, onAddTask }) {
  const [taskName, setTaskName] = useState('');
  const [types, setTypes] = useState({
    Type1: false,
    Type2: false,
    Type3: false,
    Type4: false,
    Type5: false,
    Type6: false,
  });
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');

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

  if (!isOpen || typeof document === 'undefined') return null;

  // Today's local date in YYYY-MM-DD format to prevent choosing past dates as deadlines
  const now = new Date();
  const minDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const handleTypeChange = (key) => {
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let deadlineIso = null;
    if (deadline) {
      const timePart = deadlineTime || '23:59';
      const combined = new Date(`${deadline}T${timePart}:00`);
      if (!isNaN(combined.getTime())) {
        deadlineIso = combined.toISOString();
      }
    }

    await onAddTask({
      TaskName: taskName,
      ...types,
      Deadline: deadlineIso,
    });

    setTaskName('');
    setTypes({
      Type1: false,
      Type2: false,
      Type3: false,
      Type4: false,
      Type5: false,
      Type6: false,
    });
    setDeadline('');
    setDeadlineTime('23:59');
    onClose();
  };

  return createPortal(
    <div
      className="modal-portal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-task-heading"
    >
      <section
        className="popUp active modal-medium-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (X) */}
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close add task modal"
        >
          &times;
        </button>

        <form id="taskForm" onSubmit={handleSubmit} className="modal-form-layout">
          <header className="modal-header-block">
            <span className="modal-eyebrow-label">Create Task</span>
            <h2 id="add-task-heading" className="modal-adaptive-title modal-title-lg">
              Add New Task
            </h2>
          </header>

          <div className="form-element modal-body-scroll">
            {/* Task Name field */}
            <div className="modal-field-group">
              <label className="modal-field-label" htmlFor="task">
                Task Name
              </label>
              <input
                type="text"
                id="task"
                required
                placeholder="New task..."
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </div>

            {/* Task Category Checkboxes */}
            <div className="modal-field-group">
              <span className="modal-field-label">
                Categories <small>(Choose all that apply)</small>
              </span>
              <div className="modal-checkbox-grid">
                {taskTypes.map((t) => (
                  <label key={t.id} htmlFor={t.id} className="modal-checkbox-item">
                    <input
                      type="checkbox"
                      id={t.id}
                      checked={types[t.key]}
                      onChange={() => handleTypeChange(t.key)}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Deadline Date & Time Pickers */}
            <div className="modal-field-group">
              <label className="modal-field-label" htmlFor="deadLine">
                Deadline
              </label>
              <div className="modal-deadline-inputs">
                <input
                  type="date"
                  id="deadLine"
                  min={minDate}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <input
                  type="time"
                  id="deadLineTime"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  disabled={!deadline}
                  title="Deadline Time"
                />
              </div>
            </div>
          </div>

          <footer className="modal-footer-bar">
            <button id="addSubmit" type="submit" className="btn modal-submit-btn full-width-btn">
              Submit
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

