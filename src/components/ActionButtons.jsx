/**
 * ============================================================================
 * FILE: src/components/ActionButtons.jsx
 * ============================================================================
 * PURPOSE:
 *   Primary navigation toolbar rendering the four main action buttons:
 *   "To-Do List", "Calendar", "Archive", and "+ Add task".
 *
 * CORE RESPONSIBILITIES:
 *   1. Dispatches view-switching callbacks (`onTodoClick`, `onCalendarClick`,
 *      `onArchiveClick`) to `App.jsx`.
 *   2. Dispatches modal-opening callback (`onAddTaskClick`) to open `AddTaskModal`.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `ActionButtons`
 * ============================================================================
 */

import React from 'react';

/**
 * ActionButtons Component
 * The main toolbar providing navigation between views and triggering task creation.
 * 
 * Props:
 * - onTodoClick: callback to switch to the To-Do List view (or toggle mini-calendar)
 * - onCalendarClick: callback to toggle the full month BigCalendar view
 * - onArchiveClick: callback to switch to the completed tasks Archive view
 * - onAddTaskClick: callback to open the Add Task modal
 */
export default function ActionButtons({
  onTodoClick,
  onCalendarClick,
  onArchiveClick,
  onAddTaskClick,
}) {
  return (
    <section className="sectButton">
      {/* To-Do List button */}
      <button
        id="todo"
        className="mybutton"
        type="button"
        onClick={onTodoClick}
      >
        <i className="fa-regular fa-clipboard"></i>
        <b> To-Do List</b>
      </button>

      {/* Calendar toggle button */}
      <button
        id="Calendar"
        className="mybutton"
        type="button"
        onClick={onCalendarClick}
      >
        <i className="fa-regular fa-calendar-days"></i>
        <b>Calendar</b>
      </button>

      {/* Archive view button */}
      <button
        id="archived"
        className="mybutton"
        type="button"
        onClick={onArchiveClick}
      >
        <i className="fa-solid fa-archive"></i>
        <b>Archive</b>
      </button>

      {/* Add Task modal trigger button */}
      <button
        id="addTask"
        className="mybutton addbutton"
        type="button"
        onClick={onAddTaskClick}
      >
        <i className="fa-solid fa-plus"></i>
        <b>Add task</b>
      </button>
    </section>
  );
}
