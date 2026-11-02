import React from 'react';

/**
 * TaskList Component
 * Displays a list of task cards (either active tasks or archived tasks).
 * 
 * Props:
 * - tasks: array of formatted task objects to display
 * - currentViewMode: 'todo' | 'archive' (controls empty state message)
 * - isHidden: boolean, hides the task list when BigCalendar is open
 * - onTaskClick: callback invoked when a user clicks on a task card (opens details modal)
 */
export default function TaskList({
  tasks = [],
  currentViewMode = 'todo',
  isHidden = false,
  onTaskClick,
}) {
  return (
    <section className="taskCont">
      <ul id="tasks" className={isHidden ? 'hidden-section' : ''}>
        {/* If no tasks are returned, display an appropriate empty state notice */}
        {tasks.length === 0 ? (
          <p
            style={{
              width: '100%',
              textAlign: 'center',
              color: '#666',
              fontSize: '18px',
              marginTop: '20px',
            }}
          >
            {currentViewMode === 'archive'
              ? 'No archived tasks found.'
              : 'No tasks found.'}
          </p>
        ) : (
          // Render each task card
          tasks.map((task) => {
            // Display up to 2 category badges on the card; show "..." badge if more exist
            let categoriesToDisplay = [...(task.categories || [])];
            let hasMore = false;
            if (categoriesToDisplay.length > 2) {
              categoriesToDisplay = categoriesToDisplay.slice(0, 2);
              hasMore = true;
            }

            return (
              <li
                key={task.id}
                className="taskList"
                data-id={task.id || ''}
                onClick={() => onTaskClick(task)}
              >
                {/* Task title */}
                <h2>{task.name || task.TaskName}</h2>

                {/* Category tags */}
                <div className="category-container">
                  {categoriesToDisplay.map((cat, idx) => (
                    <div
                      key={idx}
                      style={{ fontSize: '2vh' }}
                      className={cat}
                    >
                      {cat}
                    </div>
                  ))}
                  {hasMore && (
                    <div style={{ fontSize: '2vh' }} className="...">
                      ...
                    </div>
                  )}
                </div>

                {/* Deadline formatted string with Google Classroom badge */}
                <h4 className="task-deadline">
                  <span>{task.deadLine}</span>
                  {task.source === 'google_classroom' && (
                    <img
                      src="/Pictures/GoogleClassroom.svg"
                      alt="Google Classroom"
                      className="classroom-badge-icon"
                      title="Imported from Google Classroom"
                    />
                  )}
                </h4>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
