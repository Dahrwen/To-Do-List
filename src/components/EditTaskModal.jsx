import React, { useState, useEffect } from 'react';

const taskTypes = [
  { id: 'etype1', key: 'Type1', label: 'Personal' },
  { id: 'etype2', key: 'Type2', label: 'Urgent' },
  { id: 'etype3', key: 'Type3', label: 'Growth' },
  { id: 'etype4', key: 'Type4', label: 'Academics' },
  { id: 'etype5', key: 'Type5', label: 'Interactive' },
  { id: 'etype6', key: 'Type6', label: 'Social' },
];

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
    setDeadline(t.Deadline ? t.Deadline.split('T')[0] : '');
    setDescription(t.Description || '');
  };

  useEffect(() => {
    if (task) {
      resetToTask(task);
    }
  }, [task]);

  if (!task) return null;

  const handleTypeChange = (key) => {
    setTypes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onUpdateTask(task.id, {
      TaskName: taskName,
      ...types,
      Deadline: deadline || null,
      Description: description,
    });
    onClose();
  };

  const handleReset = (e) => {
    e.preventDefault();
    resetToTask(task);
  };

  return (
    <section className={`popUp2 ${isOpen ? 'active2' : ''}`} id="taskDetails">
      <div className="close-btn" onClick={onClose}>
        &times;
      </div>
      <form id="editForm" onSubmit={handleSubmit} onReset={handleReset}>
        <h1 style={{ textAlign: 'center' }}>
          {task.TaskName}
          <div style={{ fontSize: '2vh', color: '#ad1313' }}>Edit Task</div>
        </h1>
        <div className="form-element">
          <label htmlFor="etask">Enter Task Name: </label>
          <input
            type="text"
            id="etask"
            required
            placeholder={task.TaskName}
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
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
          <label htmlFor="edeadLine">Deadline: </label>
          <input
            type="date"
            id="edeadLine"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <br />
          <label htmlFor="edescription">Add a description: </label>
          <textarea
            id="edescription"
            rows="3"
            placeholder="Add a comment..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <button type="submit" className="btn">
            Submit
          </button>
          <button type="reset" className="btn">
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}
