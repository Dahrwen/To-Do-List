import React, { useRef, useState, useEffect } from 'react';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export default function MiniCalendar({ tasks = [], isHidden = false }) {
  const carouselRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startScrollLeft: 0, isDragging: false });

  const currentDate = new Date();

  // Compute tasks for next 14 days
  const daysData = [];
  for (let x = 0; x < 14; x++) {
    const d = new Date();
    d.setDate(currentDate.getDate() + x);
    const formattedDate = d.toISOString().split('T')[0];

    const dayTasks = [];
    tasks.forEach((t) => {
      if (t.finished || !t.Deadline) return;
      const taskDeadline = new Date(t.Deadline).toISOString().split('T')[0];
      if (formattedDate === taskDeadline) {
        dayTasks.push(t.TaskName);
      }
    });

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
