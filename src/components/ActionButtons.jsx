/**
 * ============================================================================
 * FILE: src/components/ActionButtons.jsx
 * ============================================================================
 * PURPOSE:
 *   Renders the primary navigation and control bar above the task grid:
 *   - Left group: "To-Do List", "Calendar", "Archive" tabs + "Filter ⌵" dropdown
 *   - Right group: "+ Add task" primary action button aligned to the far right
 *
 * CORE RESPONSIBILITIES:
 *   1. View Switching:
 *      Dispatches `onTodoClick`, `onCalendarClick`, and `onArchiveClick` to
 *      `App.jsx` and highlights the currently active tab with an underline bar.
 *   2. Deadline Filtering ("Filter ⌵" Dropdown):
 *      Provides a dropdown menu immediately next to "Archive" allowing the user
 *      to filter both To-Do List and Archive cards by deadline window:
 *        - All Tasks (default)
 *        - This Week
 *        - Next Week
 *        - Later
 *        - No Due Date
 *        - Late (Overdue)
 *   3. Task Creation Trigger:
 *      Renders the "+ Add task" button on the far-right side (`margin-left: auto`).
 *
 * IMPORTS FROM:
 *   - 'react': `useState`, `useEffect`, `useRef`
 *
 * EXPORTS TO:
 *   - `src/App.jsx`: Default export `ActionButtons`
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';

/**
 * Available deadline filter options displayed inside the "Filter ⌵" dropdown.
 */
export const FILTER_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'later', label: 'Later' },
  { value: 'no_due_date', label: 'No Due Date' },
  { value: 'late', label: 'Late' },
];

/**
 * ActionButtons Component
 *
 * @param {Object} props
 * @param {string} props.currentViewMode - Current active list mode ('todo' | 'archive')
 * @param {boolean} props.showBigCalendar - True when the full-month BigCalendar view is active
 * @param {string} props.selectedFilter - Active deadline filter key ('all' | 'this_week' | 'next_week' | 'later' | 'no_due_date' | 'late')
 * @param {Function} props.onFilterChange - Callback `(filterValue: string) => void` invoked when a filter option is selected
 * @param {Function} props.onTodoClick - Callback to switch to the To-Do List view
 * @param {Function} props.onCalendarClick - Callback to toggle the full-month BigCalendar view
 * @param {Function} props.onArchiveClick - Callback to switch to the Archive view
 * @param {Function} props.onAddTaskClick - Callback to open the AddTaskModal
 * @returns {JSX.Element}
 */
export default function ActionButtons({
  currentViewMode = 'todo',
  showBigCalendar = false,
  selectedFilter = 'all',
  onFilterChange,
  onTodoClick,
  onCalendarClick,
  onArchiveClick,
  onAddTaskClick,
}) {
  // Tracks whether the "Filter ⌵" dropdown menu is open
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);

  /**
   * Automatically closes the Filter dropdown when the user clicks anywhere outside it.
   */
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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Determine which navigation tab is currently active for the bottom indicator bar
  const isTodoActive = !showBigCalendar && currentViewMode === 'todo';
  const isCalendarActive = showBigCalendar;
  const isArchiveActive = !showBigCalendar && currentViewMode === 'archive';

  // Resolve human-readable label for the currently selected filter
  const activeFilterObj = FILTER_OPTIONS.find(
    (opt) => opt.value === selectedFilter
  );
  const filterButtonLabel =
    selectedFilter === 'all' || !activeFilterObj
      ? 'Filter'
      : `Filter: ${activeFilterObj.label}`;

  /**
   * Handles selecting an option from the Filter dropdown.
   * Clicking the already-active filter resets back to 'all'.
   */
  const handleSelectFilter = (value) => {
    if (onFilterChange) {
      const nextValue =
        selectedFilter === value && value !== 'all' ? 'all' : value;
      onFilterChange(nextValue);
    }
    setIsFilterOpen(false);
  };

  return (
    <section className="sectButton">
      {/* Left Navigation Group: Tabs + Filter Dropdown */}
      <div className="sectButton-left">
        {/* To-Do List Tab */}
        <div className={`tab-btn-wrapper ${isTodoActive ? 'active-tab' : ''}`}>
          <button
            id="todo"
            className="mybutton"
            type="button"
            onClick={onTodoClick}
          >
            <i className="fa-regular fa-clipboard"></i>
            <b>To-Do List</b>
          </button>
        </div>

        {/* Calendar Tab */}
        <div
          className={`tab-btn-wrapper ${isCalendarActive ? 'active-tab' : ''}`}
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

        {/* Archive Tab */}
        <div
          className={`tab-btn-wrapper ${isArchiveActive ? 'active-tab' : ''}`}
        >
          <button
            id="archived"
            className="mybutton"
            type="button"
            onClick={onArchiveClick}
          >
            <i className="fa-solid fa-archive"></i>
            <b>Archive</b>
          </button>
        </div>

        {/* Filter Dropdown Button immediately next to Archive */}
        <div
          ref={filterDropdownRef}
          className={`filter-dropdown-wrapper ${isFilterOpen ? 'open' : ''}`}
        >
          <button
            id="filterBtn"
            className={`mybutton filter-btn ${
              selectedFilter !== 'all' ? 'filter-active' : ''
            }`}
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={isFilterOpen}
          >
            <b>{filterButtonLabel}</b>
            <i className="fa-solid fa-chevron-down filter-chevron"></i>
          </button>

          {/* Dropdown Menu Options */}
          {isFilterOpen && (
            <ul className="filter-dropdown-menu" role="listbox">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = selectedFilter === option.value;
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={`filter-dropdown-item ${
                        isSelected ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectFilter(option.value)}
                    >
                      <span>{option.label}</span>
                      {isSelected && (
                        <i className="fa-solid fa-check filter-check-icon"></i>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Far-Right Primary Action Button: "+ Add task" */}
      <div className="sectButton-right">
        <button
          id="addTask"
          className="mybutton addbutton"
          type="button"
          onClick={onAddTaskClick}
        >
          <i className="fa-solid fa-plus"></i>
          <b>Add task</b>
        </button>
      </div>
    </section>
  );
}
