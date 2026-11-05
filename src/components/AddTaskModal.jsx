/**
 * ============================================================================
 * FILE: src/components/AddTaskModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Modal popup dialog allowing the user to create a new manual task with a
 *   name, up to 6 category tags (`Type1`..`Type6`), and an optional deadline
 *   date + time (`timestamptz`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Controlled Form State:
 *      Tracks `taskName`, `types` (`Type1`..`Type6`), `deadline` (`YYYY-MM-DD`),
 *      and `deadlineTime` (`HH:MM`, defaulting to `'23:59'`).
 *   2. ISO `timestamptz` Construction (`handleSubmit`):
 *      Combines the local date and time inputs (`new Date("${deadline}T${timePart}:00")`)
 *      and converts them to an ISO-8601 UTC string (`.toISOString()`) for
 *      storage in Supabase's `timestamptz` `Deadline` column.
 *
 * IMPORTS FROM:
 *   - 'react': `useState` hook
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `AddTaskModal`
 * ============================================================================
 */

// Import React hooks:
// - useState: to manage task form inputs (task name, category checkboxes, deadline date & time)
import React, { useState } from 'react';

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
 * Modal dialog for inputting and submitting a new task with both date and time.
 *
 * Props:
 * - isOpen: boolean, whether the modal is visible
 * - onClose: callback to close the modal
 * - onAddTask: async callback invoked with new task data (TaskName, Type1..Type6, Deadline)
 */
export default function AddTaskModal({ isOpen, onClose, onAddTask }) {
  // Form input states
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

  // Today's local date in YYYY-MM-DD format to prevent choosing past dates as deadlines
  const now = new Date();
  const minDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  // Toggles an individual category checkbox on/off
  const handleTypeChange = (key) => {
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handles form submission
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

    // Reset form fields back to empty defaults
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

  return (
    <section className={`popUp ${isOpen ? 'active' : ''}`}>
      {/* Close button (X) */}
      <div className="close-btn" onClick={onClose}>
        &times;
      </div>

      <form id="taskForm" onSubmit={handleSubmit}>
        <h2>Add New Task</h2>
        <div className="form-element">
          {/* Task Name field */}
          <label htmlFor="task">Enter Task Name: </label>
          <input
            type="text"
            id="task"
            required
            placeholder="New task..."
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
          <br />

          {/* Task Category Checkboxes */}
          <label>Pick type of task:</label>
          <br />
          <label style={{ fontSize: '1.5vh' }}>(Choose all that applies)</label>
          <br />
          {taskTypes.map((t) => (
            <React.Fragment key={t.id}>
              <input
                type="checkbox"
                id={t.id}
                checked={types[t.key]}
                onChange={() => handleTypeChange(t.key)}
              />
              <label htmlFor={t.id}>{t.label}</label>
              <br />
            </React.Fragment>
          ))}

          {/* Deadline Date & Time Pickers */}
          <label htmlFor="deadLine">Deadline: </label>
          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
          <br />
          <br />

          {/* Submit button */}
          <button id="addSubmit" type="submit" className="btn">
            Submit
          </button>
        </div>
      </form>
    </section>
  );
}
