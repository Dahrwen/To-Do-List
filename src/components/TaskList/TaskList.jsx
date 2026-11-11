/**
 * ============================================================================
 * FILE: src/components/TaskList/TaskList.jsx
 * ============================================================================
 * PURPOSE:
 *   Autonomous, comprehensive component that renders the 5-column normalized
 *   task cards grid and the integrated floating pagination slider pill
 *   ([ < • • • > ]) for both "To-Do List" and "Archive" views.
 *
 * CORE RESPONSIBILITIES:
 *   1. Normalized 5-Column Responsive Card Grid:
 *      Renders up to 10 cards per page (5 columns × 2 rows) in default mode,
 *      or up to 15 cards per page (5 columns × 3 rows) when expanded mode
 *      (`isExpanded === true`) is active via double-clicking "To-Do List" or "Archive".
 *   2. Task Card Delegation:
 *      Maps tasks dynamically to isolated `<TaskCard />` items via `.map()`.
 *   3. Integrated Floating Pagination Slider:
 *      Presents the docked `< • • • >` navigation directly tied to the card
 *      collection at the bottom-center of the viewport.
 *      - When `totalPages <= 1`, locks arrows with disabled state and displays
 *        a single neutral dot.
 *      - When `totalPages > 1`, enables interactive `<` / `>` pagination and
 *        direct dot navigation.
 *
 * IMPORTS FROM:
 *   - 'react': Core React library
 *   - '../TaskCard': `TaskCard` component
 *   - './TaskList.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/TaskList/index.js`
 *   - `src/App.jsx`: Default export `TaskList`
 * ============================================================================
 */

import React from 'react';
import TaskCard from '../TaskCard';
import './TaskList.css';

/**
 * FloatingPagination Component (Integrated Sub-Component)
 *
 * @param {Object} props
 * @param {number} props.currentPage - Zero-based active page index
 * @param {number} props.totalPages - Total number of pages (minimum 1)
 * @param {Function} props.onPageChange - Callback `(newPageIndex) => void`
 * @param {boolean} [props.isHidden=false] - Hides the floating slider when Calendar view is active
 */
export function FloatingPagination({
  currentPage = 0,
  totalPages = 1,
  onPageChange,
  isHidden = false,
}) {
  if (isHidden) {
    return null;
  }

  const isSinglePage = totalPages <= 1;
  const isPrevDisabled = isSinglePage || currentPage <= 0;
  const isNextDisabled = isSinglePage || currentPage >= totalPages - 1;

  const handlePrevPage = () => {
    if (!isPrevDisabled && onPageChange) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (!isNextDisabled && onPageChange) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <nav
      className="floating-pagination-pill"
      aria-label="Task pagination"
    >
      <button
        type="button"
        className={`pagination-arrow ${isPrevDisabled ? 'disabled' : ''}`}
        onClick={handlePrevPage}
        disabled={isPrevDisabled}
        aria-label="Previous page"
      >
        &lt;
      </button>

      <div className="pagination-dots">
        {Array.from({ length: Math.max(1, totalPages) }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            className={`pagination-dot ${
              idx === currentPage ? 'active' : ''
            } ${isSinglePage ? 'single-dot' : ''}`}
            onClick={() => {
              if (!isSinglePage && onPageChange) {
                onPageChange(idx);
              }
            }}
            disabled={isSinglePage}
            aria-label={`Page ${idx + 1}`}
          />
        ))}
      </div>

      <button
        type="button"
        className={`pagination-arrow ${isNextDisabled ? 'disabled' : ''}`}
        onClick={handleNextPage}
        disabled={isNextDisabled}
        aria-label="Next page"
      >
        &gt;
      </button>
    </nav>
  );
}

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

      {/* Integrated Floating Bottom Pagination Pill Component ([ < • • • > ]) */}
      <FloatingPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        isHidden={isHidden}
      />
    </section>
  );
}
