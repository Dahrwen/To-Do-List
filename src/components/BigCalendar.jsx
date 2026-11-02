// Import React hooks:
// - useState: to manage the active month/year being viewed on the calendar
import React, { useState } from 'react';

// Full month names for the calendar header
const monthsFull = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * BigCalendar Component
 * Renders a full month 7x5 / 7x6 calendar grid displaying:
 * - Current, previous, and next month overflow days
 * - Task deadline items scheduled for each day
 * - Previous (<) and next (>) month pagination
 * - Highlight for "today"
 * 
 * Props:
 * - tasks: array of unfinished tasks from Supabase
 * - isHidden: boolean, hides the calendar section when toggled off
 */
export default function BigCalendar({ tasks = [], isHidden = true }) {
  const [calendarDate, setCalendarDate] = useState(new Date()); // State for the month/year currently displayed
  const today = new Date();                                     // Current real-world date for highlighting "today"

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();           // Day index (0=Sun, 6=Sat) of the 1st day of the month
  const lastDay = new Date(year, month + 1, 0).getDate();       // Total number of days in the current month

  // Navigate to previous month
  const handlePrev = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };

  // Navigate to next month
  const handleNext = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };

  /**
   * Finds all tasks whose deadline matches the specified calendar cell date.
   * Truncates to max 3 entries with '...' overflow.
   */
  const getTasksForDate = (checkDate) => {
    const yyyy = checkDate.getFullYear();
    const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
    const dd = String(checkDate.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const taskList = [];
    tasks.forEach((t) => {
      if (t.finished || !t.Deadline) return;
      const taskDeadline = t.Deadline.split('T')[0];
      if (formattedDate === taskDeadline) {
        taskList.push(t.TaskName);
      }
    });

    if (taskList.length === 0) return [];

    if (taskList.length > 3) {
      const topTwo = taskList.slice(0, 3);
      topTwo[2] += '...';
      return topTwo;
    }

    return taskList;
  };

  // 1. Compute leading overflow days from the previous month
  const prevDays = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDay; i > 0; i--) {
    const dayNum = prevMonthLastDay - i + 1;
    const checkDate = new Date(year, month - 1, dayNum);
    prevDays.push({
      dayNum,
      isFade: true, // Render with dimmed opacity
      isToday: false,
      taskList: getTasksForDate(checkDate),
    });
  }

  // 2. Compute active days of the current month
  const currentDays = [];
  for (let i = 1; i <= lastDay; i++) {
    const checkDate = new Date(year, month, i);
    const isToday =
      i === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();
    currentDays.push({
      dayNum: i,
      isFade: false,
      isToday,
      taskList: getTasksForDate(checkDate),
    });
  }

  // 3. Compute trailing overflow days from the next month to fill the last row
  const nextDays = [];
  const nextMonthStartDay = 7 - new Date(year, month + 1, 0).getDay() - 1;
  for (let i = 1; i <= nextMonthStartDay; i++) {
    const checkDate = new Date(year, month + 1, i);
    nextDays.push({
      dayNum: i,
      isFade: true, // Render with dimmed opacity
      isToday: false,
      taskList: getTasksForDate(checkDate),
    });
  }

  // Combine all day cells into one flat array for rendering
  const allDays = [...prevDays, ...currentDays, ...nextDays];

  return (
    <section className={`calendarBig ${isHidden ? 'hidden-section' : ''}`}>
      {/* Calendar header with month/year and navigation arrows */}
      <div className="header">
        <b id="prev" onClick={handlePrev}>
          &lt;
        </b>
        <h1 id="month-year">
          {monthsFull[month]} {year}
        </h1>
        <b id="next" onClick={handleNext}>
          &gt;
        </b>
      </div>

      {/* Weekday column names (Sun - Sat) */}
      <div className="weekdays" id="weekdays">
        <ul id="weekdayList">
          <li>Sun</li>
          <li>Mon</li>
          <li>Tue</li>
          <li>Wed</li>
          <li>Thu</li>
          <li>Fri</li>
          <li>Sat</li>
        </ul>
      </div>

      {/* Grid of days */}
      <div className="days" id="days">
        {allDays.map((d, index) => {
          const classNames = [
            d.isFade ? 'fade' : '',
            d.isToday ? 'today' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div key={index} className={classNames || undefined}>
              <span>{d.dayNum}</span>
              <p style={{ fontSize: '12px', marginTop: '5px' }}>
                {d.taskList.map((taskName, tIdx) => (
                  <React.Fragment key={tIdx}>
                    {taskName}
                    {tIdx < d.taskList.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
