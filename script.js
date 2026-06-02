const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let currentDate = new Date();

for(let x = 0; x < 14 ; x++){
    let d = new Date();
    d.setDate(currentDate.getDate() + x);

    document.getElementById("dates").innerHTML += `
        <li class="card">
                <h2>${dayNames[d.getDay()]}</h2>
                <h4>${months[d.getMonth()]} ${d.getDate()}</h4>
        </li>
    `;
}

const carousel = document.querySelector(".carousel");
const arrowBtns = document.querySelectorAll(".wrapper b");
const extraVH = window.innerHeight * 0.0452;
const firstCardWidth = (carousel.querySelector(".card").offsetWidth) + extraVH;


let isDragging = false, startX, startScrollLeft;

arrowBtns.forEach(btn => {
    btn.addEventListener ("click", () =>{
        carousel.scrollLeft += btn.id === "left" ? -firstCardWidth : firstCardWidth;
    })
});

const dragStart = (e) => {
    isDragging = true;
    carousel.classList.add("dragging");
    //Records where the cursor is in the carousel
    startX = e.pageX;
    startScrollLeft = carousel.scrollLeft;
}

const dragging = (e) => {
    if(!isDragging) return; //Stop when not dragging
    //Updates the scroll position
    carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
}

const dragStop = () => {
    isDragging = false;
    carousel.classList.remove("dragging");
}
carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("mousemove", dragging);
document.addEventListener("mouseup", dragStop);

//popUp button
document.querySelector("#addTask").addEventListener("click", function(){
    document.querySelector(".popUp").classList.add("active");
});
document.querySelector(".popUp .close-btn").addEventListener("click", function(){
    document.querySelector(".popUp").classList.remove("active");
});

const minDate = currentDate.toISOString().split('T')[0]; 
document.getElementById("deadLine").setAttribute("min", minDate);

const addSubmit = document.getElementById("addSubmit");

const taskTypes = ["Personal", "Urgent", "Growth", "Academics", "Interactive", "Social"];
let taskArr = [];

document.getElementById("taskForm").addEventListener("submit", function(e){
    e.preventDefault(); 

    let selectedTypes = [];
    
    // We loop through all checkboxes (type1 to type6)
    for (let i = 1; i <= 6; i++) {
        let checkbox = document.getElementById("type" + i);
        
        if (checkbox.checked) {
            selectedTypes.push(taskTypes[i - 1]);
        }
    }

    let dateInput = document.getElementById("deadLine").value; // "2026-01-29"
    let dateObj = new Date(dateInput);
    let dateString = dateObj.toDateString();

    if(!dateInput){
        dateString = "No due date";
    }else{
        dateString.split(' ').slice(1).join(' ')
    }

    let newTask = {
        name: document.getElementById("task").value,
        categories: selectedTypes, // This now contains ["Urgent", "Social"], etc.
        deadLine: dateString
    };
    taskArr.push(newTask);
    
    // UI Cleanup
    document.querySelector(".popUp").classList.remove("active");
    document.getElementById("taskForm").reset();

    // Create a string of HTML elements for the categories
    const categoryHTML = newTask.categories.map(cat => `<div class = "${cat}">${cat}</div>`).join('');

    document.getElementById("tasks").innerHTML += `
        <li class="taskList">
            <h2>${newTask.name}</h2>
            <p class="category-container">
                ${categoryHTML}
            </p>
            <h4>${newTask.deadLine}</h4>
        </li>
    `;
    
    document.querySelector(".popUp").classList.remove("active");
})

//Big Callendar
document.addEventListener('DOMContentLoaded', function(){
    const monthYear = document.getElementById('month-year');
    const daysCont = document.getElementById('days');
    const prevButton = document.getElementById('prev');
    const nextButton = document.getElementById('next');
    
    let today = new Date();
    function renderCalendar(date){
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();

        monthYear.textContent = `${monthsFull[month]} ${year}`;

        daysCont.innerHTML = '';

        //Prev Month
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for(let i = firstDay; i > 0; i--){
            const dayDiv = document.createElement('div');
            dayDiv.textContent = prevMonthLastDay - i + 1;
            dayDiv.classList.add('fade');
            daysCont.appendChild(dayDiv);
        }

        //Current Month
        for(let i = 1; i <= lastDay; i++){
            const dayDiv = document.createElement('div');
            dayDiv.textContent = i;
            if(i==today.getDate() && month == today.getMonth() && year == today.getFullYear()){
                dayDiv.classList.add('today');
            }
            daysCont.appendChild(dayDiv);
        }

        //Next Month
        const nextMonthStartDay = 7 - new Date(year, month + 1, 0).getDay() - 1;
        for(let i = 1; i <= nextMonthStartDay; i++){
            const dayDiv = document.createElement('div');
            dayDiv.textContent = i;
            dayDiv.classList.add('fade');
            daysCont.appendChild(dayDiv);
        }

    }

    prevButton.addEventListener('click', function(){
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    })

    nextButton.addEventListener('click', function(){
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    })

    renderCalendar(currentDate);
}) 


//Button Effect of doom
let repeat = false;

document.querySelectorAll("#Calendar").forEach(button => {
    button.onclick = function(e) {
        const calendar = document.getElementById("calendarSection");
        const buttonClicked = e.target.id;

        if(repeat == false){
            calendar.classList.add("hidden-section");
            document.querySelector("#tasks").classList.add("hidden-section");
            document.querySelector(".calendarBig").classList.remove("hidden-section");
            repeat = true;
        }else{
            calendar.classList.remove("hidden-section");
            document.querySelector(".calendarBig").classList.add("hidden-section");
            document.querySelector("#tasks").classList.remove("hidden-section");
            repeat = false;
        }
    };
});

let repeat2 = repeat;

document.querySelectorAll("#todo").forEach(button => {
    button.onclick = function(e) {
        const calendar = document.getElementById("calendarSection");
        const buttonClicked = e.target.id;

        if(repeat == false){
            calendar.classList.add("hidden-section");
            document.querySelector(".calendarBig").classList.add("hidden-section");
            document.querySelector("#tasks").classList.remove("hidden-section");
            repeat = true;
        }else{
            calendar.classList.remove("hidden-section");
            document.querySelector(".calendarBig").classList.add("hidden-section");
            document.querySelector("#tasks").classList.remove("hidden-section");
            repeat = false;
        }
    };
});