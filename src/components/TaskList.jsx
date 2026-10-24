import React from 'react';

export default function TaskList({
  tasks = [],
  currentViewMode = 'todo',
  isHidden = false,
  onTaskClick,
}) {
  return (
    <section className="taskCont">
      <ul id="tasks" className={isHidden ? 'hidden-section' : ''}>
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
          tasks.map((task) => {
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
                <h2>{task.name || task.TaskName}</h2>
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
                <h4>{task.deadLine}</h4>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
