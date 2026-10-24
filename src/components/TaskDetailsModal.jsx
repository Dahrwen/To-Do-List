import React from 'react';

export default function TaskDetailsModal({
  isOpen,
  task,
  onClose,
  onFinish,
  onEdit,
  onDelete,
}) {
  if (!task) return null;

  const categories = task.categories || [];
  const description = !task.Description
    ? 'Edit to add description'
    : task.Description;
  const deadline = !task.Deadline ? 'No Due Date' : task.Deadline;
  const finishBtnLabel = task.finished ? 'Restore' : 'Finish';

  return (
    <section className={`popUpDesc ${isOpen ? 'activeDesc' : ''}`}>
      <div className="close-btn" onClick={onClose}>
        &times;
      </div>
      <div id="taskDesc">
        <h1 style={{ textAlign: 'center' }}>Task Details</h1>
        <p>
          <b>Task Name: </b>
          {task.TaskName}
        </p>
        <ul>
          {categories.map((cat, idx) => (
            <li
              key={idx}
              style={{ fontSize: '2.5vh' }}
              className={cat}
            >
              {cat}
            </li>
          ))}
        </ul>
        <p>
          <b>Deadline: </b>
          {deadline}
        </p>
        <b>Task Description:</b>
        <p style={{ fontSize: '2vh' }}>{description}</p>
        <button
          className="fButton"
          id="finishButton"
          type="button"
          onClick={() => onFinish(task.id)}
        >
          {finishBtnLabel}
        </button>
        <button
          className="eButton"
          id="editButton"
          type="button"
          onClick={() => onEdit(task)}
        >
          Edit
        </button>
        <img
          id="delete"
          style={{
            height: 'clamp(26px, 4vh, 34px)',
            position: 'absolute',
            bottom: '20px',
            right: '24px',
            cursor: 'pointer',
          }}
          src="/Pictures/TrashCan.png"
          alt="Delete"
          onClick={() => onDelete(task.id)}
        />
      </div>
    </section>
  );
}
