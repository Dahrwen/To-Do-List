/**
 * ============================================================================
 * FILE: src/components/TaskDetailsModal.jsx
 * ============================================================================
 * PURPOSE:
 *   Modal dialog displaying the complete details of a selected task (title,
 *   all category tags, formatted date & time deadline, and full description
 *   including Google Classroom course name and link), along with actions to
 *   Finish/Restore, Edit, or Delete the task.
 *
 * CORE RESPONSIBILITIES:
 *   1. Full Task Inspection:
 *      Shows all assigned categories (even when truncated to 2 on the card)
 *      and formats `task.Deadline` into `"Mon DD YYYY • h:mm AM/PM"`.
 *   2. Task Lifecycle Actions:
 *      - `onFinish(task.id)`: Toggles `finished` between `false` (To-Do) and `true` (Archive).
 *      - `onEdit(task)`: Transitions from `TaskDetailsModal` to `EditTaskModal`.
 *      - `onDelete(task.id)`: Permanently deletes the task row from Supabase `Tasks`.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `TaskDetailsModal`
 * ============================================================================
 */

import React from 'react';

/**
 * TaskDetailsModal Component
 * Modal dialog that displays full details of a selected task:
 * - Task name, categories, formatted deadline, and description
 * - "Finish" / "Restore" button to toggle completion status
 * - "Edit" button to open the edit modal
 * - Trash can icon to delete the task
 * 
 * Props:
 * - isOpen: boolean, whether the modal is open
 * - task: object, the selected task data
 * - onClose: callback to close the modal
 * - onFinish: callback to toggle task completion (finished / unfinished)
 * - onEdit: callback to switch to EditTaskModal
 * - onDelete: callback to delete the task from Supabase
 */
export default function TaskDetailsModal({
  isOpen,
  task,
  onClose,
  onFinish,
  onEdit,
  onDelete,
}) {
  // If no task is selected, don't render anything
  if (!task) return null;

  const categories = task.categories || [];
  const description = !task.Description
    ? 'Edit to add description'
    : task.Description;
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

  // If task is completed (finished: true), button says "Restore", otherwise "Finish"
  const finishBtnLabel = task.finished ? 'Restore' : 'Finish';

  return (
    <section className={`popUpDesc ${isOpen ? 'activeDesc' : ''}`}>
      {/* Close button (X) */}
      <div className="close-btn" onClick={onClose}>
        &times;
      </div>

      <div id="taskDesc">
        <h1 style={{ textAlign: 'center' }}>Task Details</h1>

        {/* Task Name */}
        <p>
          <b>Task Name: </b>
          {task.TaskName}
        </p>

        {/* Categories list */}
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

        {/* Deadline */}
        <p>
          <b>Deadline: </b>
          {deadline}
        </p>

        {/* Description text */}
        <b>Task Description:</b>
        <p style={{ fontSize: '2vh' }}>{description}</p>

        {/* Finish / Restore button */}
        <button
          className="fButton"
          id="finishButton"
          type="button"
          onClick={() => onFinish(task.id)}
        >
          {finishBtnLabel}
        </button>

        {/* Edit button */}
        <button
          className="eButton"
          id="editButton"
          type="button"
          onClick={() => onEdit(task)}
        >
          Edit
        </button>

        {/* Delete trash can icon */}
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
