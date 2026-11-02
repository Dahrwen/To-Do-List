// Import React hooks:
// - useState: to manage task form inputs (task name, category checkboxes, deadline)
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
 * Modal dialog for inputting and submitting a new task.
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

  // Today's date in YYYY-MM-DD format to prevent choosing past dates as deadlines
  const minDate = new Date().toISOString().split('T')[0];

  // Toggles an individual category checkbox on/off
  const handleTypeChange = (key) => {
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handles form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAddTask({
      TaskName: taskName,
      ...types,
      Deadline: deadline || null,
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

          {/* Deadline Date Picker */}
          <label htmlFor="deadLine">Deadline: </label>
          <input
            type="date"
            id="deadLine"
            min={minDate}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
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
