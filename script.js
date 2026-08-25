const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

//Function to render tasks array into HTML
function renderTasksUI() {
    const tasksContainer = document.getElementById("tasks");
    tasksContainer.innerHTML = ""; // Clear existing list to prevent duplicates

    taskArr.forEach(task => {
        const categoryHTML = task.categories
            .map(cat => `<div style="font-size: 2vh" class="${cat}">${cat}</div>`)
            .join('');

        tasksContainer.innerHTML += `
            <li class="taskList" data-id="${task.id || ''}">
                <h2>${task.name}</h2>
                <p class="category-container">
                    ${categoryHTML}
                </p>
                <h4>${task.deadLine}</h4>
            </li>
        `;
    });
}

//Fetch tasks from Supabase and rebuild taskArr on page load
async function loadTasks(searchTask) {
    query = supabaseClient
        .from('Tasks')
        .select('*');

    if(searchTask && searchTask.trim() != ""){
        query = query.ilike('TaskName',`%${searchTask.trim()}%`);
    }

    const { data: tasks, error } = await query

    if (error) {
        console.error('Error fetching tasks from Supabase:', error.message);
        return;
    }

    // Convert database structure to matches your taskArr objects
    taskArr = tasks.map(task => {
        let selectedTypes = [];
        if (task.Type1) selectedTypes.push(taskTypes[0]);
        if (task.Type2) selectedTypes.push(taskTypes[1]);
        if (task.Type3) selectedTypes.push(taskTypes[2]);
        if (task.Type4) selectedTypes.push(taskTypes[3]);
        if (task.Type5) selectedTypes.push(taskTypes[4]);
        if (task.Type6) selectedTypes.push(taskTypes[5]);

        let dateString = "No due date";
        if (task.Deadline) {
            let dateObj = new Date(task.Deadline);
            dateString = dateObj.toDateString().split(' ').slice(1).join(' ');
        }

        return {
            id: task.id,
            name: task.TaskName,
            categories: selectedTypes,
            deadLine: dateString
        };
    });

    renderTasksUI();
}

//Submit Handler - Insert into Supabase
document.getElementById("taskForm").addEventListener("submit", async function(e){
    e.preventDefault(); 

    let dateInput = document.getElementById("deadLine").value;

    // Insert task row directly into Supabase
    const { data, error } = await supabaseClient
        .from('Tasks')
        .insert([
            {
                TaskName: document.getElementById("task").value,
                Type1: document.getElementById("type1").checked,
                Type2: document.getElementById("type2").checked,
                Type3: document.getElementById("type3").checked,
                Type4: document.getElementById("type4").checked,
                Type5: document.getElementById("type5").checked,
                Type6: document.getElementById("type6").checked,
                Deadline: dateInput || null
            }
        ]);

    if (error) {
        console.error("Error inserting task into Supabase:", error.message);
        return;
    }

    // Reset UI inputs
    document.querySelector(".popUp").classList.remove("active");
    document.getElementById("taskForm").reset();

    // Re-fetch from DB to display the updated task list
    loadTasks();
});

//Searching for Task
const searchTask = document.getElementById("searchTextId");

searchTask.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        loadTasks(searchTask.value);
        searchTask.value = "";
    }
});

// Load existing tasks on startup
loadTasks();

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
        document.querySelector(".popUp").classList.remove("active");
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
        document.querySelector(".popUp").classList.remove("active");
    };
});