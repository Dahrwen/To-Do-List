/**
 * ============================================================================
 * COMPONENT: TaskModal
 * FILE: src/components/TaskModal/TaskModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Unified task modal system providing dialogs for:
 *   1. Task Details inspection (`TaskDetailsModal` / `mode="details"`).
 *   2. Task Editing (`EditTaskModal` / `mode="edit"`).
 *   3. Task Creation (`AddTaskModal` / `mode="create"`).
 *
 * CORE RESPONSIBILITIES:
 *   - Top-layer React Portal rendering to `document.body` at `z-index: 9999`.
 *   - Adaptive title typography scaling based on character length.
 *   - Google Classroom deadline immutability locking & badge presentation.
 *   - Controlled form state & ISO-8601 UTC deadline serialization.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useEffect`
 *   - 'react-dom': `createPortal`
 *   - './TaskModal.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/TaskModal/index.js`
 *   - `src/App.jsx`: `TaskModal`, `TaskDetailsModal`, `EditTaskModal`, `AddTaskModal`, `getAdaptiveTitleClass`
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './TaskModal.css';

// 6 category options matching the database boolean columns (Type1 to Type6)
const taskTypes = [
  { id: 'type1', key: 'Type1', label: 'Personal' },
  { id: 'type2', key: 'Type2', label: 'Urgent' },
  { id: 'type3', key: 'Type3', label: 'Growth' },
  { id: 'type4', key: 'Type4', label: 'Academics' },
  { id: 'type5', key: 'Type5', label: 'Interactive' },
  { id: 'type6', key: 'Type6', label: 'Social' },
];

/**
 * Computes adaptive typography class for modal titles based on character length.
 */
export const getAdaptiveTitleClass = (title = '') => {
  const len = String(title).trim().length;
  if (len <= 30) return 'modal-title-lg';
  if (len <= 60) return 'modal-title-md';
  return 'modal-title-sm';
};

/**
 * 1. TaskDetailsModal Component (Inspect task details)
 */
export function TaskDetailsModal({
  isOpen,
  task,
  onClose,
  onFinish,
  onEdit,
  onDelete,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
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
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close task details"
        >
          &times;
        </button>

        <header className="modal-header-block">
          <span className="modal-eyebrow-label">Task Details</span>
          <h1 id="task-details-heading" className={`modal-adaptive-title ${titleSizeClass}`}>
            {taskTitle}
          </h1>
        </header>

        <div id="taskDesc" className="modal-body-scroll">
          <div className="modal-meta-grid">
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

          <div className="modal-field-group">
            <span className="modal-field-label">Task Description</span>
            <div className="modal-description-box">{description}</div>
          </div>
        </div>

        <footer className="modal-footer-bar">
          <div className="modal-footer-left">
            <button
              className="eButton modal-action-btn"
              id="editButton"
              type="button"
              onClick={() => onEdit && onEdit(task)}
            >
              Edit
            </button>

            <button
              className="fButton modal-action-btn"
              id="finishButton"
              type="button"
              onClick={() => onFinish && onFinish(task.id)}
            >
              {finishBtnLabel}
            </button>
          </div>

          <button
            type="button"
            className="modal-delete-btn"
            disabled={isGoogleClassroom}
            onClick={() => {
              if (!isGoogleClassroom && onDelete) {
                onDelete(task.id);
              }
            }}
            title={
              isGoogleClassroom
                ? 'Google Classroom tasks cannot be deleted to prevent losing schoolwork'
                : 'Delete task'
            }
            aria-label={
              isGoogleClassroom
                ? 'Delete disabled for Google Classroom task'
                : 'Delete task'
            }
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

/**
 * 2. EditTaskModal Component (Edit existing task)
 */
export function EditTaskModal({ isOpen, task, onClose, onUpdateTask }) {
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
      if (e.key === 'Escape') onClose();
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

    if (onUpdateTask) {
      await onUpdateTask(task.id, updatePayload);
    }
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
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close edit task modal"
        >
          &times;
        </button>

        <form id="editForm" onSubmit={handleSubmit} onReset={handleReset} className="modal-form-layout">
          <header className="modal-header-block">
            <span className="modal-eyebrow-label edit-eyebrow">Edit Task</span>
            <h1 id="edit-task-heading" className={`modal-adaptive-title ${titleSizeClass}`}>
              {displayTitle}
            </h1>
          </header>

          <div className="form-element modal-body-scroll">
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

            <div className="modal-meta-grid">
              <div className="modal-field-group">
                <span className="modal-field-label">
                  Categories <small>(Choose all that apply)</small>
                </span>
                <div className="modal-checkbox-grid">
                  {taskTypes.map((t) => (
                    <label key={t.id} htmlFor={`e${t.id}`} className="modal-checkbox-item">
                      <input
                        type="checkbox"
                        id={`e${t.id}`}
                        checked={types[t.key]}
                        onChange={() => handleTypeChange(t.key)}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

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

/**
 * 3. AddTaskModal Component (Create new task)
 */
export function AddTaskModal({ isOpen, onClose, onAddTask }) {
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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

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

    if (onAddTask) {
      await onAddTask({
        TaskName: taskName,
        ...types,
        Deadline: deadlineIso,
      });
    }

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

            <div className="modal-field-group">
              <span className="modal-field-label">
                Categories <small>(Choose all that apply)</small>
              </span>
              <div className="modal-checkbox-grid">
                {taskTypes.map((t) => (
                  <label key={t.id} htmlFor={`add${t.id}`} className="modal-checkbox-item">
                    <input
                      type="checkbox"
                      id={`add${t.id}`}
                      checked={types[t.key]}
                      onChange={() => handleTypeChange(t.key)}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

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

/**
 * Unified TaskModal Component
 *
 * @param {Object} props
 * @param {'details'|'edit'|'create'} [props.mode='details'] - Mode of the modal
 */
export function TaskModal({ mode = 'details', ...props }) {
  if (mode === 'create' || mode === 'add') {
    return <AddTaskModal {...props} />;
  }
  if (mode === 'edit') {
    return <EditTaskModal {...props} />;
  }
  return <TaskDetailsModal {...props} />;
}

TaskModal.Details = TaskDetailsModal;
TaskModal.Edit = EditTaskModal;
TaskModal.Add = AddTaskModal;

export default TaskModal;

