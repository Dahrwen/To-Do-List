/**
 * ============================================================================
 * COMPONENT: Calendar
 * FILE: src/components/Calendar/Calendar.jsx
 * ============================================================================
 * PURPOSE:
 *   Unified Calendar component system providing both the 14-day horizontal
 *   draggable carousel strip (`view="mini"`) and the full-month 7-column grid
 *   view (`view="month"`).
 *
 * CORE RESPONSIBILITIES:
 *   1. Mini View (`view="mini"` | `<MiniCalendar />`):
 *      - Computes 14 consecutive calendar days starting from today in local time.
 *      - Matches active tasks by local `YYYY-MM-DD` and sorts by earliest time.
 *      - Supports mouse drag gestures and `<` / `>` arrow scrolling.
 *   2. Month View (`view="month"` | `<BigCalendar />`):
 *      - Computes leading previous-month overflow days, active month days
 *        (highlighting "today"), and trailing next-month days.
 *      - Previews up to 3 task deadlines per day cell with `...` overflow.
 *      - Month pagination backward/forward across months and years.
 *
 * IMPORTS FROM:
 *   - 'react': `useRef`, `useState`, `useEffect`
 *   - './Calendar.css': Scoped component styles
 *
 * EXPORTS TO:
 *   - `src/components/Calendar/index.js`
 *   - `src/App.jsx`: Default export `Calendar`, named exports `MiniCalendar`, `BigCalendar`
 * ============================================================================
 */

import React, { useRef, useState, useEffect } from 'react';
import './Calendar.css';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
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
 * Formats a date value into local YYYY-MM-DD string for safe date matching.
 */
function toLocalDateKey(dateVal) {
  const dt = new Date(dateVal);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

/**
 * MiniCalendar Sub-Component (14-Day Horizontal Carousel Strip)
 */
export function MiniCalendar({ tasks = [], isHidden = false }) {
  const carouselRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startScrollLeft: 0, isDragging: false });
  const currentDate = new Date();

  const daysData = [];
  for (let x = 0; x < 14; x++) {
    const d = new Date();
    d.setDate(currentDate.getDate() + x);
    const formattedDate = toLocalDateKey(d);

    const matchingTasks = [];
    tasks.forEach((t) => {
      if (t.finished || !t.Deadline) return;
      const taskDeadline = toLocalDateKey(t.Deadline);
      if (formattedDate === taskDeadline) {
        matchingTasks.push(t);
      }
    });

    matchingTasks.sort(
      (a, b) => new Date(a.Deadline).getTime() - new Date(b.Deadline).getTime()
    );
    const dayTasks = matchingTasks.map((t) => t.TaskName);

    let displayTasks = [];
    if (dayTasks.length > 3) {
      const topThree = dayTasks.slice(0, 3);
      topThree[2] += '...';
      displayTasks = topThree;
    } else {
      displayTasks = dayTasks;
    }

    daysData.push({
      dayName: dayNames[d.getDay()],
      monthName: monthsShort[d.getMonth()],
      dateNum: d.getDate(),
      tasks: displayTasks,
    });
  }

  const handleArrowClick = (direction) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const firstCard = carousel.querySelector('.card');
    if (!firstCard) return;

    const carouselStyle = window.getComputedStyle(carousel);
    const gap = parseFloat(carouselStyle.columnGap || carouselStyle.gap) || 14;
    const scrollDistance = firstCard.offsetWidth + gap;

    carousel.scrollLeft += direction === 'left' ? -scrollDistance : scrollDistance;
  };

  const handleMouseDown = (e) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    dragInfo.current = {
      isDragging: true,
      startX: e.pageX,
      startScrollLeft: carousel.scrollLeft,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragInfo.current.isDragging || !carouselRef.current) return;
      carouselRef.current.scrollLeft =
        dragInfo.current.startScrollLeft - (e.pageX - dragInfo.current.startX);
    };

    const handleMouseUp = () => {
      if (dragInfo.current.isDragging) {
        dragInfo.current.isDragging = false;
        setIsDragging(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <section
      id="calendarSection"
      className={`wrapper container ${isHidden ? 'hidden-section' : ''}`}
    >
      <b
        id="left"
        className="btn"
        onClick={() => handleArrowClick('left')}
      >
        &lt;
      </b>

      <ul
        id="dates"
        ref={carouselRef}
        className={`carousel child ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        {daysData.map((day, idx) => (
          <li className="card" key={idx}>
            <h2>{day.dayName}</h2>
            <h4>
              {day.monthName} {day.dateNum}
            </h4>
            {day.tasks.length > 0 && (
              <div className="mini-card-tasks">
                {day.tasks.map((taskText, tIdx) => (
                  <p className="mini-card-task-item" key={tIdx}>
                    {taskText}
                  </p>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <b
        id="right"
        className="btn"
        onClick={() => handleArrowClick('right')}
      >
        &gt;
      </b>
    </section>
  );
}

/**
 * BigCalendar Sub-Component (Full Month Grid View)
 */
export function BigCalendar({ tasks = [], isHidden = true }) {
  const [calendarDate, setCalendarDate] = useState(new Date());
  const today = new Date();

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();

  const handlePrev = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };

  const handleNext = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };

  const getTasksForDate = (checkDate) => {
    const formattedDate = toLocalDateKey(checkDate);

    const matchingTasks = [];
    tasks.forEach((t) => {
      if (t.finished || !t.Deadline) return;
      const taskDeadline = toLocalDateKey(t.Deadline);
      if (formattedDate === taskDeadline) {
        matchingTasks.push(t);
      }
    });

    matchingTasks.sort(
      (a, b) => new Date(a.Deadline).getTime() - new Date(b.Deadline).getTime()
    );
    const taskList = matchingTasks.map((t) => t.TaskName);

    if (taskList.length === 0) return [];

    if (taskList.length > 3) {
      const topTwo = taskList.slice(0, 3);
      topTwo[2] += '...';
      return topTwo;
    }

    return taskList;
  };

  const prevDays = [];
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDay; i > 0; i--) {
    const dayNum = prevMonthLastDay - i + 1;
    const checkDate = new Date(year, month - 1, dayNum);
    prevDays.push({
      dayNum,
      isFade: true,
      isToday: false,
      taskList: getTasksForDate(checkDate),
    });
  }

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

  const nextDays = [];
  const nextMonthStartDay = 7 - new Date(year, month + 1, 0).getDay() - 1;
  for (let i = 1; i <= nextMonthStartDay; i++) {
    const checkDate = new Date(year, month + 1, i);
    nextDays.push({
      dayNum: i,
      isFade: true,
      isToday: false,
      taskList: getTasksForDate(checkDate),
    });
  }

  const allDays = [...prevDays, ...currentDays, ...nextDays];

  return (
    <section className={`calendarBig ${isHidden ? 'hidden-section' : ''}`}>
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

/**
 * Unified Calendar Component
 *
 * @param {Object} props
 * @param {'mini'|'month'} [props.view='mini'] - Calendar view mode
 * @param {Array<Object>} props.tasks - Tasks array
 * @param {boolean} [props.isHidden=false] - Hidden state
 */
export default function Calendar({ view = 'mini', tasks = [], isHidden = false, ...rest }) {
  if (view === 'month' || view === 'big') {
    return <BigCalendar tasks={tasks} isHidden={isHidden} {...rest} />;
  }
  return <MiniCalendar tasks={tasks} isHidden={isHidden} {...rest} />;
}

Calendar.Mini = MiniCalendar;
Calendar.Month = BigCalendar;
