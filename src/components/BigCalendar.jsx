import React, { useState } from 'react';

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

export default function BigCalendar({ tasks = [], isHidden = true }) {
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

  // Prev Month Days
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

  // Current Month Days
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

  // Next Month Days
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
