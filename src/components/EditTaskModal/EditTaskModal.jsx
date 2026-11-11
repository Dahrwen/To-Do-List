/**
 * ============================================================================
 * FILE: src/components/EditTaskModal/EditTaskModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Top-layer React Portal modal dialog (`createPortal` to `document.body`)
 *   for editing an existing task's name, category tags, deadline date & time
 *   (`timestamptz`), and description inside a spacious container.
 *
 * CORE RESPONSIBILITIES:
 *   1. Top-Most Layering via React Portal:
 *      Renders directly into `document.body` at `z-index: 9999` with a full
 *      backdrop overlay.
 *   2. Adaptive Header Typography:
 *      Scales the task title preview dynamically (`<=30`, `31-60`, `>60` chars).
 *   3. Google Classroom Deadline Immutability Lock:
 *      Inspects `task.source === 'google_classroom'`. When true, locks and
 *      disables the deadline date/time inputs (`disabled`, `pointer-events-none`)
 *      with a `"Deadline managed by Google Classroom"` badge and prevents
 *      mutating `Deadline` on form submission.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useEffect`
 *   - 'react-dom': `createPortal`
 *   - '../TaskDetailsModal': `getAdaptiveTitleClass`
 *   - './EditTaskModal.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/EditTaskModal/index.js`
 *   - `src/App.jsx`: Default export `EditTaskModal`
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAdaptiveTitleClass } from '../TaskDetailsModal';
import './EditTaskModal.css';

// Definitions for the 6 task category options matching the database boolean columns (Type1 to Type6)
const taskTypes = [
  { id: 'etype1', key: 'Type1', label: 'Personal' },
  { id: 'etype2', key: 'Type2', label: 'Urgent' },
  { id: 'etype3', key: 'Type3', label: 'Growth' },
  { id: 'etype4', key: 'Type4', label: 'Academics' },
  { id: 'etype5', key: 'Type5', label: 'Interactive' },
  { id: 'etype6', key: 'Type6', label: 'Social' },
];

/**
 * EditTaskModal Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Object|null} props.task - The active task to edit
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onUpdateTask - Async callback `(taskId, updatedData) => Promise<void>`
 */
export default function EditTaskModal({ isOpen, task, onClose, onUpdateTask }) {
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
  const [description, setDescription] = useState('');

  const resetToTask = (t) => {
    if (!t) return;
    setTaskName(t.TaskName || '');
    setTypes({
      Type1: !!t.Type1,
      Type2: !!t.Type2,
      Type3: !!t.Type3,
      Type4: !!t.Type4,
      Type5: !!t.Type5,
      Type6: !!t.Type6,
    });

    if (t.Deadline) {
      const d = new Date(t.Deadline);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setDeadline(`${yyyy}-${mm}-${dd}`);
        setDeadlineTime(`${hh}:${min}`);
      } else {
        setDeadline('');
        setDeadlineTime('23:59');
      }
    } else {
      setDeadline('');
      setDeadlineTime('23:59');
    }

    setDescription(t.Description || '');
  };

  useEffect(() => {
    if (task) {
      resetToTask(task);
    }
  }, [task]);

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

  const isGoogleClassroom =
    task.source === 'google_classroom' ||
    Boolean(task.Description && task.Description.includes('[Google Classroom]'));

  const displayTitle = taskName || task.TaskName || 'Edit Task';
  const titleSizeClass = getAdaptiveTitleClass(displayTitle);

  const handleTypeChange = (key) => {
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const updatePayload = {
      TaskName: taskName,
      ...types,
      Description: description,
    };

    // Enforce Google Classroom Deadline Immutability: only allow deadline edits on manual tasks
    if (!isGoogleClassroom) {
      let deadlineIso = null;
      if (deadline) {
        const timePart = deadlineTime || '23:59';
        const combined = new Date(`${deadline}T${timePart}:00`);
        if (!isNaN(combined.getTime())) {
          deadlineIso = combined.toISOString();
        }
      }
      updatePayload.Deadline = deadlineIso;
    }

    await onUpdateTask(task.id, updatePayload);
    onClose();
  };

  const handleReset = (e) => {
    e.preventDefault();
    resetToTask(task);
  };

  return createPortal(
    <div
      className="modal-portal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-heading"
    >
      <section
        className="popUp2 active2 modal-wide-dialog"
        id="taskDetails"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button (X) */}
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close edit task modal"
        >
          &times;
        </button>

        <form id="editForm" onSubmit={handleSubmit} onReset={handleReset} className="modal-form-layout">
          {/* Compact Adaptive Header */}
          <header className="modal-header-block">
            <span className="modal-eyebrow-label edit-eyebrow">Edit Task</span>
            <h1 id="edit-task-heading" className={`modal-adaptive-title ${titleSizeClass}`}>
              {displayTitle}
            </h1>
          </header>

          {/* Scrollable Form Body */}
          <div className="form-element modal-body-scroll">
            {/* Edit Task Name */}
            <div className="modal-field-group">
              <label className="modal-field-label" htmlFor="etask">
                Task Name
              </label>
              <input
                type="text"
                id="etask"
                required
                placeholder={task.TaskName}
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </div>

            {/* Two-column row for Categories & Deadline */}
            <div className="modal-meta-grid">
              {/* Edit Categories */}
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

              {/* Edit Deadline Date & Time (Locked if imported from Google Classroom) */}
              <div className="modal-field-group">
                <label className="modal-field-label" htmlFor="edeadLine">
                  Deadline
                </label>
                {isGoogleClassroom ? (
                  <div
                    className="locked-deadline-box"
                    title="Deadline managed by Google Classroom"
                  >
                    <div className="locked-deadline-inputs">
                      <input
                        type="date"
                        id="edeadLine"
                        value={deadline}
                        disabled
                        readOnly
                        tabIndex={-1}
                      />
                      <input
                        type="time"
                        id="edeadLineTime"
                        value={deadlineTime}
                        disabled
                        readOnly
                        tabIndex={-1}
                      />
                    </div>
                    <div className="classroom-lock-badge">
                      <img
                        src="/Pictures/GoogleClassroom.svg"
                        alt="Google Classroom"
                        className="classroom-badge-icon"
                      />
                      <i className="fa-solid fa-lock" aria-hidden="true"></i>
                      <span>Deadline managed by Google Classroom</span>
                    </div>
                  </div>
                ) : (
                  <div className="modal-deadline-inputs">
                    <input
                      type="date"
                      id="edeadLine"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                    <input
                      type="time"
                      id="edeadLineTime"
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value)}
                      disabled={!deadline}
                      title="Deadline Time"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Edit Description */}
            <div className="modal-field-group">
              <label className="modal-field-label" htmlFor="edescription">
                Task Description
              </label>
              <textarea
                id="edescription"
                rows="4"
                placeholder="Add a comment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Dedicated Non-Overlapping Footer Actions */}
          <footer className="modal-footer-bar">
            <button type="submit" className="btn modal-submit-btn">
              Save Changes
            </button>
            <button type="reset" className="btn modal-reset-btn">
              Reset
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  );
}

