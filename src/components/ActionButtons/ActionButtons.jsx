/**
 * ============================================================================
 * FILE: src/components/ActionButtons/ActionButtons.jsx
 * ============================================================================
 * PURPOSE:
 *   Primary navigation and filter toolbar rendering:
 *   - Left group: "To-Do List", "Calendar", "Archive" tab buttons + "Filter ⌵"
 *     deadline filter dropdown (`This Week`, `Next Week`, `Later`, `No Due Date`, `Late`).
 *   - Right side: "+ Add task" button anchored to the far right (`margin-left: auto`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Dispatches view-switching (`onTodoClick`, `onCalendarClick`, `onArchiveClick`)
 *      and double-click expanded-view toggles (`onTodoDoubleClick`, `onArchiveDoubleClick`).
 *   2. Manages the "Filter ⌵" dropdown state and outside-click dismissal,
 *      notifying `App.jsx` via `onFilterChange(filterKey)`.
 *   3. Dispatches `onAddTaskClick` to open `AddTaskModal`.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useRef`, `useEffect`
 *   - './ActionButtons.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/ActionButtons/index.js`
 *   - `src/App.jsx`: Default export `ActionButtons`
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';
import './ActionButtons.css';

// Deadline filter options displayed in the "Filter ⌵" dropdown menu
const FILTER_OPTIONS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'this_week', label: 'This Week' },
  { key: 'next_week', label: 'Next Week' },
  { key: 'later', label: 'Later' },
  { key: 'no_due_date', label: 'No Due Date' },
  { key: 'late', label: 'Late' },
];

/**
 * ActionButtons Component
 *
 * @param {Object} props
 * @param {string} props.currentViewMode - 'todo' | 'archive'
 * @param {boolean} props.showBigCalendar - True when full-month Calendar view is open
 * @param {string} props.activeFilter - Currently active deadline filter key
 * @param {Function} props.onFilterChange - Callback `(filterKey) => void`
 * @param {Function} props.onTodoClick - Single-click handler for "To-Do List"
 * @param {Function} props.onTodoDoubleClick - Double-click handler to toggle 3-row expanded view on "To-Do List"
 * @param {Function} props.onCalendarClick - Handler to toggle full-month BigCalendar view
 * @param {Function} props.onArchiveClick - Single-click handler for "Archive"
 * @param {Function} props.onArchiveDoubleClick - Double-click handler to toggle 3-row expanded view on "Archive"
 * @param {Function} props.onAddTaskClick - Handler to open the Add Task modal
 */
export default function ActionButtons({
  currentViewMode = 'todo',
  showBigCalendar = false,
  activeFilter = 'all',
  onFilterChange,
  onTodoClick,
  onTodoDoubleClick,
  onCalendarClick,
  onArchiveClick,
  onArchiveDoubleClick,
  onAddTaskClick,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  // Close the Filter dropdown when clicking anywhere outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedFilterObj = FILTER_OPTIONS.find((f) => f.key === activeFilter);
  const filterButtonLabel =
    activeFilter !== 'all' && selectedFilterObj
      ? selectedFilterObj.label
      : 'Filter';

  const handleSelectFilter = (key) => {
    // Clicking the currently active filter toggles it back to 'all'
    const nextFilter = activeFilter === key && key !== 'all' ? 'all' : key;
    if (onFilterChange) {
      onFilterChange(nextFilter);
    }
    setIsFilterOpen(false);
  };

  return (
    <section className="sectButton">
      {/* Left group: Tab pills + Filter dropdown */}
      <div className="sectButton-left">
        {/* To-Do List button (single-click switches tab; double-click toggles 3-row expanded mode) */}
        <div
          className={`tab-pill-wrapper ${
            !showBigCalendar && currentViewMode === 'todo' ? 'active-tab' : ''
          }`}
        >
          <button
            id="todo"
            className="mybutton"
            type="button"
            onClick={onTodoClick}
            onDoubleClick={onTodoDoubleClick}
            title="Click to view To-Do List • Double-click to toggle full-screen 3-row view"
          >
            <i className="fa-regular fa-clipboard"></i>
            <b> To-Do List</b>
          </button>
        </div>

        {/* Calendar toggle button */}
        <div
          className={`tab-pill-wrapper ${showBigCalendar ? 'active-tab' : ''}`}
        >
          <button
            id="Calendar"
            className="mybutton"
            type="button"
            onClick={onCalendarClick}
          >
            <i className="fa-regular fa-calendar-days"></i>
            <b>Calendar</b>
          </button>
        </div>

        {/* Archive view button (single-click switches tab; double-click toggles 3-row expanded mode) */}
        <div
          className={`tab-pill-wrapper ${
            !showBigCalendar && currentViewMode === 'archive' ? 'active-tab' : ''
          }`}
        >
          <button
            id="archived"
            className="mybutton"
            type="button"
            onClick={onArchiveClick}
            onDoubleClick={onArchiveDoubleClick}
            title="Click to view Archive • Double-click to toggle full-screen 3-row view"
          >
            <i className="fa-solid fa-archive"></i>
            <b>Archive</b>
          </button>
        </div>

        {/* Filter dropdown button immediately following Archive */}
        <div
          ref={filterDropdownRef}
          className={`filter-dropdown-wrapper ${isFilterOpen ? 'open' : ''}`}
        >
          <button
            id="filterTasks"
            className={`mybutton filter-btn ${
              activeFilter !== 'all' ? 'filter-active' : ''
            }`}
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
          >
            <b>{filterButtonLabel}</b>
            <i className="fa-solid fa-chevron-down filter-chevron"></i>
          </button>

          {isFilterOpen && (
            <div className="filter-dropdown-menu" role="menu">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = activeFilter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`filter-dropdown-item ${
                      isSelected ? 'selected' : ''
                    }`}
                    onClick={() => handleSelectFilter(option.key)}
                  >
                    <span>{option.label}</span>
                    {isSelected && <i className="fa-solid fa-check"></i>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Add Task modal trigger button anchored to the far right */}
      <button
        id="addTask"
        className="mybutton addbutton sectButton-right"
        type="button"
        onClick={onAddTaskClick}
      >
        <i className="fa-solid fa-plus"></i>
        <b>Add task</b>
      </button>
    </section>
  );
}

