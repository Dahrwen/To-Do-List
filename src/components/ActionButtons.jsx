import React from 'react';

export default function ActionButtons({
  onTodoClick,
  onCalendarClick,
  onArchiveClick,
  onAddTaskClick,
}) {
  return (
    <section className="sectButton">
      <button
        id="todo"
        className="mybutton"
        type="button"
        onClick={onTodoClick}
      >
        <i className="fa-regular fa-clipboard"></i>
        <b> To-Do List</b>
      </button>
      <button
        id="Calendar"
        className="mybutton"
        type="button"
        onClick={onCalendarClick}
      >
        <i className="fa-regular fa-calendar-days"></i>
        <b>Calendar</b>
      </button>
      <button
        id="archived"
        className="mybutton"
        type="button"
        onClick={onArchiveClick}
      >
        <i className="fa-solid fa-archive"></i>
        <b>Archive</b>
      </button>
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
