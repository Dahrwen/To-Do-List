// Import React hooks:
// - useRef: holds references to the carousel DOM element and drag coordinate tracking
// - useState: manages whether the mouse is currently dragging the carousel
// - useEffect: registers window mousemove and mouseup event listeners for smooth dragging
import React, { useRef, useState, useEffect } from 'react';

// Days of the week names for card headers
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Short month abbreviations for date display
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

/**
 * MiniCalendar Component
 * A 14-day horizontal carousel displaying upcoming days and their associated task deadlines.
 * Supports:
 * - Drag-to-scroll mouse gestures
 * - Left (<) and right (>) arrow button navigation
 * - Task preview truncation (shows up to 3 tasks per day, adds "..." if more)
 * 
 * Props:
 * - tasks: array of unfinished task objects from Supabase
 * - isHidden: boolean, hides the calendar section when toggled off
 */
export default function MiniCalendar({ tasks = [], isHidden = false }) {
  const carouselRef = useRef(null); // Reference to the scrollable <ul> carousel
  const [isDragging, setIsDragging] = useState(false); // State for CSS .dragging class
  
  // Mutable drag tracker (stored in ref to avoid re-rendering on every mouse move)
  const dragInfo = useRef({ startX: 0, startScrollLeft: 0, isDragging: false });

  const currentDate = new Date();

  // Compute calendar days data for the next 14 consecutive days starting today
  const daysData = [];
  for (let x = 0; x < 14; x++) {
    const d = new Date();
    d.setDate(currentDate.getDate() + x);
    const formattedDate = d.toISOString().split('T')[0]; // "YYYY-MM-DD" format

    // Find all active tasks matching this day's deadline
    const dayTasks = [];
    tasks.forEach((t) => {
      if (t.finished || !t.Deadline) return;
      const taskDeadline = new Date(t.Deadline).toISOString().split('T')[0];
      if (formattedDate === taskDeadline) {
        dayTasks.push(t.TaskName);
      }
    });

    // Truncate to maximum 3 tasks per day card
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
      monthName: months[d.getMonth()],
      dateNum: d.getDate(),
      tasks: displayTasks,
    });
  }

  // Scrolls carousel by one card width + gap when arrow buttons (< or >) are clicked
  const handleArrowClick = (direction) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const firstCard = carousel.querySelector('.card');
    if (!firstCard) return;

    // Read dynamic card spacing from computed styles
    const carouselStyle = window.getComputedStyle(carousel);
    const gap = parseFloat(carouselStyle.columnGap || carouselStyle.gap) || 14;
    const scrollDistance = firstCard.offsetWidth + gap;

    carousel.scrollLeft += direction === 'left' ? -scrollDistance : scrollDistance;
  };

  // Begins mouse drag gesture
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

  // Registers global mousemove and mouseup listeners to allow dragging even if cursor leaves carousel
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
      {/* Scroll left button */}
      <b
        id="left"
        className="btn"
        onClick={() => handleArrowClick('left')}
      >
        &lt;
      </b>

      {/* Draggable carousel container */}
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
            <p style={{ fontSize: '15px', marginTop: '5px' }}>
              {day.tasks.map((taskText, tIdx) => (
                <React.Fragment key={tIdx}>
                  {taskText}
                  {tIdx < day.tasks.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          </li>
        ))}
      </ul>

      {/* Scroll right button */}
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
