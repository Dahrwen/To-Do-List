/**
 * ============================================================================
 * FILE: src/components/TaskList.jsx
 * ============================================================================
 * PURPOSE:
 *   Renders the 5-column normalized task card grid and mounts the floating
 *   pagination slider pill (`FloatingPagination`) for both the "To-Do List"
 *   and "Archive" views.
 *
 * CORE RESPONSIBILITIES:
 *   1. Normalized 5-Column Responsive Grid:
 *      Renders up to 10 cards per page (5 columns × 2 rows) in default mode,
 *      or up to 15 cards per page (5 columns × 3 rows) when expanded mode
 *      (`isExpanded === true`) is active via double-clicking "To-Do List" or "Archive".
 *   2. Task Card Rendering & Google Classroom Badge:
 *      Displays each task's title (`TaskName`), up to 2 color-coded category
 *      labels (plus `"..."` overflow indicator), formatted deadline date/time
 *      (`task.deadLine`), and the `/Pictures/GoogleClassroom.svg` icon badge.
 *   3. Floating Pagination Slider (`FloatingPagination`):
 *      Delegates slide indicator and `< • • • >` controls to the dedicated
 *      floating pill component pinned at the bottom-center of the viewport.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library
 *   - './FloatingPagination': `FloatingPagination` component
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `TaskList`
 * ============================================================================
 */

import React from 'react';
import FloatingPagination from './FloatingPagination';
import TaskCard from './TaskCard';

/**
 * TaskList Component
 *
 * @param {Object} props
 * @param {Array<Object>} props.tasks - Current page slice of formatted task objects
 * @param {string} props.currentViewMode - 'todo' | 'archive'
 * @param {boolean} props.isHidden - Hides the task section when BigCalendar is open
 * @param {boolean} props.isExpanded - True when MiniCalendar is collapsed (3 rows × 5 cols = 15 cards max)
 * @param {number} props.currentPage - Zero-based active page index
 * @param {number} props.totalPages - Total number of pages (minimum 1)
 * @param {Function} props.onPageChange - Callback `(newPageIndex) => void`
 * @param {Function} props.onTaskClick - Callback `(task) => void` to open TaskDetailsModal
 */
export default function TaskList({
  tasks = [],
  currentViewMode = 'todo',
  isHidden = false,
  isExpanded = false,
  currentPage = 0,
  totalPages = 1,
  onPageChange,
  onTaskClick,
}) {
  if (isHidden) {
    return null;
  }

  return (
    <section
      className={`taskCont ${isExpanded ? 'taskCont-expanded' : ''}`}
    >
      {/* 5-Column Normalized Task Grid (2 rows default / 3 rows expanded) */}
      <ul
        id="tasks"
        className={isExpanded ? 'expanded-grid' : 'default-grid'}
      >
        {tasks.length === 0 ? (
          <li className="empty-tasks-notice">
            {currentViewMode === 'archive'
              ? 'No archived tasks found.'
              : 'No tasks found.'}
          </li>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isArchive={currentViewMode === 'archive'}
              isExpanded={isExpanded}
              onClick={onTaskClick}
            />
          ))
        )}
      </ul>

      {/* Dedicated Floating Bottom Pagination Pill Component ([ < • • • > ]) */}
      <FloatingPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        isHidden={isHidden}
      />
    </section>
  );
}
