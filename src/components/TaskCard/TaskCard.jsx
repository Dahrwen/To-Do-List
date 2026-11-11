/**
 * ============================================================================
 * COMPONENT: TaskCard
 * FILE: src/components/TaskCard/TaskCard.jsx
 * ============================================================================
 * PURPOSE:
 *   Autonomous, presentationally isolated task card component rendering a
 *   single task row received from Supabase.
 *
 * CORE RESPONSIBILITIES:
 *   1. Dynamic Urgency Indicator (Status Dot):
 *      - Computes calendar day difference between the task's deadline and today.
 *      - Conditionally renders a colored status dot in the top-right corner
 *        ONLY when viewing the active To-Do List (`!isArchive`).
 *      - Color progression:
 *        * 0 days / Overdue: Dark Red
 *        * 1 to 3 days: Red (progressively lighter each day)
 *        * 4 to 7 days: Yellow (progressively lighter each day)
 *        * > 7 days: Solid Green (static)
 *   2. Category & Origin Presentation:
 *      - Renders up to 2 colored category pills (with a '...' overflow indicator).
 *      - Renders the Google Classroom icon if the task originated from Classroom.
 *   3. Event Dispatch:
 *      - Invokes `onClick(task)` when the card is clicked to trigger the
 *        inspection modal in the parent container.
 * ============================================================================
 */

import React from 'react';
import './TaskCard.css';

/**
 * Calculates the calendar day difference between a deadline timestamp and today,
 * returning the corresponding urgency color and accessible description.
 *
 * @param {string|null} deadlineIso - ISO-8601 timestamp string (e.g. from Supabase timestamptz)
 * @returns {{ color: string, label: string, daysRemaining: number } | null}
 */
export function getDeadlineUrgencyColor(deadlineIso) {
  if (!deadlineIso) return null;

  const deadlineDate = new Date(deadlineIso);
  if (isNaN(deadlineDate.getTime())) return null;

  const now = new Date();

  // Normalize both dates to midnight local time to calculate pure whole calendar days
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const startOfDeadline = new Date(
    deadlineDate.getFullYear(),
    deadlineDate.getMonth(),
    deadlineDate.getDate()
  ).getTime();

  const diffMs = startOfDeadline - startOfToday;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // 1. Due today (0 days) or Overdue (< 0 days): Dark Red
  if (diffDays <= 0) {
    return {
      color: 'hsl(0, 85%, 35%)',
      label: diffDays < 0 ? `Overdue by ${Math.abs(diffDays)} day(s)` : 'Due Today',
      daysRemaining: diffDays,
    };
  }

  // 2. 1 to 3 days from now: Red, becoming progressively lighter
  // Day 1: 48% lightness | Day 2: 58% lightness | Day 3: 68% lightness
  if (diffDays >= 1 && diffDays <= 3) {
    const lightness = 38 + diffDays * 10;
    return {
      color: `hsl(0, 85%, ${lightness}%)`,
      label: `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`,
      daysRemaining: diffDays,
    };
  }

  // 3. 4 to 7 days from now: Yellow, becoming progressively lighter
  // Day 4: 45% lightness | Day 5: 53% lightness | Day 6: 61% lightness | Day 7: 69% lightness
  if (diffDays >= 4 && diffDays <= 7) {
    const step = diffDays - 4;
    const lightness = 45 + step * 8;
    return {
      color: `hsl(45, 95%, ${lightness}%)`,
      label: `Due in ${diffDays} days`,
      daysRemaining: diffDays,
    };
  }

  // 4. Greater than 7 days from now: Solid Green (static, does not lighten)
  return {
    color: 'hsl(142, 70%, 42%)',
    label: `Due in ${diffDays} days`,
    daysRemaining: diffDays,
  };
}

/**
 * TaskCard Component
 *
 * @param {Object} props
 * @param {Object} props.task - Formatted task record from Supabase
 * @param {boolean} [props.isArchive=false] - Whether the card is rendered in the Archive tab
 * @param {boolean} [props.isExpanded=false] - Whether the grid is in 3-row expanded mode
 * @param {Function} props.onClick - Click handler dispatched to parent
 */
export default function TaskCard({
  task,
  isArchive = false,
  isExpanded = false,
  onClick,
}) {
  if (!task) return null;

  // Calculate urgency dot color (only applicable when not archived and task has a valid deadline)
  const urgency = !isArchive
    ? getDeadlineUrgencyColor(task.Deadline || task.deadLine)
    : null;

  // Prepare categories (up to 2 shown; '...' if more exist)
  let categoriesToDisplay = [...(task.categories || [])];
  let hasMoreCategories = false;
  if (categoriesToDisplay.length > 2) {
    categoriesToDisplay = categoriesToDisplay.slice(0, 2);
    hasMoreCategories = true;
  }

  const isClassroom =
    task.source === 'google_classroom' ||
    Boolean(task.Description && task.Description.includes('[Google Classroom]'));

  return (
    <li
      className={`taskList task-card ${isExpanded ? 'taskList-expanded task-card-expanded' : ''}`}
      data-id={task.id || ''}
      onClick={() => onClick && onClick(task)}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.name || task.TaskName}`}
    >
      {/* Dynamic Urgency Status Dot (Top-Right Corner) */}
      {!isArchive && urgency && (
        <span
          className="task-status-dot"
          style={{ backgroundColor: urgency.color }}
          title={urgency.label}
          aria-label={urgency.label}
        />
      )}

      {/* Task Title */}
      <h2 className="task-card-title">{task.name || task.TaskName}</h2>

      {/* Category Tags */}
      <div className="category-container">
        {categoriesToDisplay.map((cat, idx) => (
          <div key={idx} className={`task-category-tag ${cat}`}>
            {cat}
          </div>
        ))}
        {hasMoreCategories && (
          <div className="task-category-tag more-categories">...</div>
        )}
      </div>

      {/* Deadline Formatted String & Google Classroom Badge */}
      <h4 className="task-deadline">
        <span>{task.deadLine}</span>
        {isClassroom && (
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
}

