/**
 * ============================================================================
 * FILE: src/components/TaskList.jsx
 * ============================================================================
 * PURPOSE:
 *   Renders the unified 5-Column × 2-Row (10 cards per page) task grid and
 *   the bottom pagination slider (`< ● ● ● >`) for both the active "To-Do List"
 *   view and the completed "Archive" view.
 *
 * CORE RESPONSIBILITIES:
 *   1. Strict 5×2 Pagination (`CARDS_PER_PAGE = 10`):
 *      Slices the filtered task list into 10-card pages so at most 2 rows of
 *      5 cards are displayed per slide.
 *   2. Responsive 5-Column Grid Card Rendering:
 *      Renders each task's title (`TaskName`), up to 2 color-coded category
 *      tags (plus `"..."` overflow indicator), calendar icon, formatted
 *      deadline string (`task.deadLine`), and Google Classroom badge
 *      (`/Pictures/GoogleClassroom.svg`).
 *   3. Always-Visible Bottom Pagination Slider:
 *      - Single-Page State (<= 10 cards): Renders 1 dot indicator and disables
 *        both `<` and `>` navigation arrows with muted styling.
 *      - Multi-Page State (> 10 cards): Renders 1 dot per 10-card slide and
 *        dynamically enables/disables `<` and `>` based on the active slide.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useEffect`
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `TaskList`
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';

/**
 * Maximum number of cards rendered per slide (5 columns × 2 rows = 10 cards).
 */
const CARDS_PER_PAGE = 10;

/**
 * TaskList Component
 *
 * @param {Object} props
 * @param {Array<Object>} props.tasks - Array of formatted & filtered task objects
 * @param {string} props.currentViewMode - 'todo' | 'archive'
 * @param {string} props.selectedFilter - Active filter key from the Filter dropdown
 * @param {boolean} props.isHidden - Hides the task section when BigCalendar is active
 * @param {Function} props.onTaskClick - Callback `(task) => void` when a card is clicked
 * @returns {JSX.Element}
 */
export default function TaskList({
  tasks = [],
  currentViewMode = 'todo',
  selectedFilter = 'all',
  isHidden = false,
  onTaskClick,
}) {
  // Current 1-based slide index for the 5x2 pagination grid
  const [currentPage, setCurrentPage] = useState(1);

  // Total number of 10-card slides (minimum 1 slide even when 0 tasks exist)
  const totalPages = Math.max(1, Math.ceil(tasks.length / CARDS_PER_PAGE));

  // Reset back to Slide 1 whenever the user switches view modes or changes the filter
  useEffect(() => {
    setCurrentPage(1);
  }, [currentViewMode, selectedFilter]);

  // Clamp currentPage if tasks are deleted/archived and totalPages decreases
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * CARDS_PER_PAGE;
  const paginatedTasks = tasks.slice(startIndex, startIndex + CARDS_PER_PAGE);

  // Navigation arrow availability
  const isSinglePage = totalPages <= 1;
  const canGoPrev = !isSinglePage && safeCurrentPage > 1;
  const canGoNext = !isSinglePage && safeCurrentPage < totalPages;

  const handlePrevPage = () => {
    if (canGoPrev) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
    }
  };

  const handleNextPage = () => {
    if (canGoNext) {
      setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    }
  };

  return (
    <section className={`taskCont ${isHidden ? 'hidden-section' : ''}`}>
      {/* 5-Column x 2-Row Card Grid Container */}
      <ul
        id="tasks"
        className={paginatedTasks.length === 0 ? 'tasks-empty' : ''}
      >
        {paginatedTasks.length === 0 ? (
          <li className="empty-tasks-message">
            {currentViewMode === 'archive'
              ? 'No archived tasks found.'
              : 'No tasks found.'}
          </li>
        ) : (
          paginatedTasks.map((task) => {
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
                {/* Task Title */}
                <h2 className="task-card-title">
                  {task.name || task.TaskName}
                </h2>

                {/* Category Tags */}
                <div className="category-container">
                  {categoriesToDisplay.map((cat, idx) => (
                    <div key={idx} className={`task-category-tag ${cat}`}>
                      {cat}
                    </div>
                  ))}
                  {hasMore && (
                    <div className="task-category-tag more-categories">...</div>
                  )}
                </div>

                {/* Due Date Row with Calendar Icon & Google Classroom Badge */}
                <h4 className="task-deadline">
                  <span className="task-deadline-left">
                    <i
                      className="fa-regular fa-calendar-days deadline-calendar-icon"
                      aria-hidden="true"
                    ></i>
                    <span className="deadline-text">{task.deadLine}</span>
                  </span>
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

      {/* Bottom Pagination Slider & Indicator Controls (< ● ● ● >) */}
      <nav
        className="pagination-slider"
        aria-label="Task cards pagination"
      >
        {/* Previous Slide Button (<) */}
        <button
          type="button"
          className={`pagination-arrow ${!canGoPrev ? 'disabled' : ''}`}
          onClick={handlePrevPage}
          disabled={!canGoPrev}
          aria-label="Previous page"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        {/* Slide Dot Indicators (Always renders at least 1 dot for single-page state) */}
        <div className="pagination-dots" role="tablist">
          {Array.from({ length: totalPages }, (_, idx) => {
            const pageNumber = idx + 1;
            const isActiveDot = pageNumber === safeCurrentPage;
            return (
              <button
                key={pageNumber}
                type="button"
                role="tab"
                aria-selected={isActiveDot}
                aria-label={`Page ${pageNumber} of ${totalPages}`}
                className={`pagination-dot ${isActiveDot ? 'active' : ''} ${
                  isSinglePage ? 'single-page-dot' : ''
                }`}
                onClick={() => {
                  if (!isSinglePage) {
                    setCurrentPage(pageNumber);
                  }
                }}
                disabled={isSinglePage}
              />
            );
          })}
        </div>

        {/* Next Slide Button (>) */}
        <button
          type="button"
          className={`pagination-arrow ${!canGoNext ? 'disabled' : ''}`}
          onClick={handleNextPage}
          disabled={!canGoNext}
          aria-label="Next page"
        >
          <i className="fa-solid fa-chevron-right"></i>
        </button>
      </nav>
    </section>
  );
}
