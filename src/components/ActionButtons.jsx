/**
 * ============================================================================
 * FILE: src/components/ActionButtons.jsx
 * ============================================================================
 * PURPOSE:
 *   Primary navigation and filter toolbar rendering:
 *   - Left group: "To-Do List", "Calendar", "Archive" tab buttons + "Filter ⌵"
 *     deadline filter dropdown (`This Week`, `Next Week`, `Later`, `No Due Date`, `Late`).
 *   - Right side: "+ Add task" button anchored to the far right (`margin-left: auto`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Deterministic Click State Machine:
 *      - First click on "To-Do List" or "Archive" activates that tab in Standard View
 *        (MiniCalendar visible, 2 rows × 5 columns = 10 cards max).
 *      - Second click on the already-active tab toggles Expanded View
 *        (MiniCalendar collapsed, 3 rows × 5 columns = 15 cards max).
 *   2. Manages the "Filter ⌵" dropdown state and outside-click dismissal,
 *      notifying `App.jsx` via `onFilterChange(filterKey)`.
 *   3. Dispatches `onAddTaskClick` to open `AddTaskModal`.
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useRef`, `useEffect`
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `ActionButtons`
 * ============================================================================
 */

import React, { useState, useRef, useEffect } from 'react';

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
 * @param {boolean} props.isExpanded - True when the active tab is in 3-row expanded mode
 * @param {string} props.activeFilter - Currently active deadline filter key
 * @param {Function} props.onFilterChange - Callback `(filterKey) => void`
 * @param {Function} props.onTodoClick - Click handler for "To-Do List" (1st click selects, 2nd click toggles expanded view)
 * @param {Function} props.onCalendarClick - Handler to toggle full-month BigCalendar view
 * @param {Function} props.onArchiveClick - Click handler for "Archive" (1st click selects, 2nd click toggles expanded view)
 * @param {Function} props.onAddTaskClick - Handler to open the Add Task modal
 */
export default function ActionButtons({
  currentViewMode = 'todo',
  showBigCalendar = false,
  isExpanded = false,
  activeFilter = 'all',
  onFilterChange,
  onTodoClick,
  onCalendarClick,
  onArchiveClick,
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

  const isTodoActive = !showBigCalendar && currentViewMode === 'todo';
  const isArchiveActive = !showBigCalendar && currentViewMode === 'archive';

  return (
    <section className="sectButton">
      {/* Left group: Tab pills + Filter dropdown */}
      <div className="sectButton-left">
        {/* To-Do List button (1st click switches tab; 2nd click on active tab toggles 3-row expanded view) */}
        <div
          className={`tab-pill-wrapper ${isTodoActive ? 'active-tab' : ''}`}
        >
          <button
            id="todo"
            className="mybutton"
            type="button"
            onClick={onTodoClick}
            title={
              isTodoActive
                ? isExpanded
                  ? 'Click to restore weekday strip (2 rows)'
                  : 'Click again to expand to 3 rows'
                : 'Switch to To-Do List'
            }
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

        {/* Archive view button (1st click switches tab; 2nd click on active tab toggles 3-row expanded view) */}
        <div
          className={`tab-pill-wrapper ${isArchiveActive ? 'active-tab' : ''}`}
        >
          <button
            id="archived"
            className="mybutton"
            type="button"
            onClick={onArchiveClick}
            title={
              isArchiveActive
                ? isExpanded
                  ? 'Click to restore weekday strip (2 rows)'
                  : 'Click again to expand to 3 rows'
                : 'Switch to Archive'
            }
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
