import React, { useState } from 'react';

const taskTypes = [
  { id: 'type1', key: 'Type1', label: 'Personal' },
  { id: 'type2', key: 'Type2', label: 'Urgent' },
  { id: 'type3', key: 'Type3', label: 'Growth' },
  { id: 'type4', key: 'Type4', label: 'Academics' },
  { id: 'type5', key: 'Type5', label: 'Interactive' },
  { id: 'type6', key: 'Type6', label: 'Social' },
];

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

  const minDate = new Date().toISOString().split('T')[0];

  const handleTypeChange = (key) => {
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAddTask({
      TaskName: taskName,
      ...types,
      Deadline: deadline || null,
    });
    // Reset
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
      <div className="close-btn" onClick={onClose}>
        &times;
      </div>
      <form id="taskForm" onSubmit={handleSubmit}>
        <h2>Add New Task</h2>
        <div className="form-element">
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
          <button id="addSubmit" type="submit" className="btn">
            Submit
          </button>
        </div>
      </form>
    </section>
  );
}
