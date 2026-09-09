const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let currentDate = new Date();

for (let x = 0; x < 14; x++) {
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

let isDragging = false, startX, startScrollLeft;

// Calculate scroll distance dynamically on click instead of a fixed initial calculation
// This ensures scrolling always moves by exactly one card width on any monitor resolution
arrowBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const firstCard = carousel.querySelector(".card");
        if (!firstCard) return;
        const carouselStyle = window.getComputedStyle(carousel);
        const gap = parseFloat(carouselStyle.columnGap || carouselStyle.gap) || 14;
        const scrollDistance = firstCard.offsetWidth + gap;
        carousel.scrollLeft += btn.id === "left" ? -scrollDistance : scrollDistance;
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
    if (!isDragging) return; //Stop when not dragging
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
document.querySelector("#addTask").addEventListener("click", function () {
    document.querySelector(".popUp").classList.add("active");
});
document.querySelector(".popUp .close-btn").addEventListener("click", function () {
    document.querySelector(".popUp").classList.remove("active");
});

document.querySelector(".popUp2 .close-btn").addEventListener("click", function () {
    document.querySelector(".popUp2").classList.remove("active2");
});

document.querySelector(".popUpDesc .close-btn").addEventListener("click", function () {
    document.querySelector(".popUpDesc").classList.remove("activeDesc");
});


const minDate = currentDate.toISOString().split('T')[0];
document.getElementById("deadLine").setAttribute("min", minDate);

const addSubmit = document.getElementById("addSubmit");

const taskTypes = ["Personal", "Urgent", "Growth", "Academics", "Interactive", "Social"];
let taskArr = [];

//Function to render tasks array into HTML
function renderTasksUI() {
    const tasksContainer = document.getElementById("tasks");
    tasksContainer.innerHTML = "";

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

    tasksContainer.addEventListener("click", function (event) {
        const taskItem = event.target.closest(".taskList");

        if (taskItem) {
            document.querySelector(".popUpDesc").classList.add("activeDesc");
            let taskId = null;
            taskId = taskItem.dataset.id;
            taskDesc(taskId);
        }
    });
}

async function taskDesc(taskId) {
    const { data: tasks, error } = await supabaseClient
        .from('Tasks')
        .select('*')
        .eq('id', taskId);

    const task = tasks[0]

    const currentTaskInArr = taskArr.find(t => t.id == taskId);

    const categoryHTML = currentTaskInArr?.categories
        ?.map(cat => `<li style="font-size: 2.5vh" class="${cat}">${cat}</li>`)
        .join('') || '';

    let Description
    if (!task.Description) {
        Description = "Edit to add description"
    } else {
        Description = task.Description
    }

    let Deadline
    if (!task.Deadline) {
        Deadline = "No Due Date";
    } else {
        Deadline = task.Deadline;
    }

    document.getElementById("taskDesc").innerHTML = `
            <h1 style = "text-align: center">Task Details</h1>
            <p><b>Task Name: </b>${task.TaskName}</p>
            <ul>${categoryHTML}</ul>
            <p><b>Deadline: </b>${Deadline}</p>
            <b>Task Description:</b>
            <p style="font-size:2vh">${Description}</p>
            <button class="eButton" id="editButton">Edit</button>
            <!-- Sized and positioned with clamp/pixels to stay aligned with the Edit button on different monitor sizes -->
            <img style="height: clamp(26px, 4vh, 34px); position: absolute; bottom: 20px; right: 24px; cursor: pointer;" src="Pictures/TrashCan.png">
            `

    document.getElementById("editButton").addEventListener("click", function (e) {
        e.preventDefault();
        document.querySelector(".popUp2").classList.add("active2");
        document.querySelector(".popUpDesc").classList.remove("activeDesc");
        editTask(taskId);
    }, { once: true });
}

async function editTask(taskId) {
    const { data: tasks, error } = await supabaseClient
        .from('Tasks')
        .select('*')
        .eq('id', taskId);

    const task = tasks[0]

    document.getElementById("editForm").innerHTML = `
                <h1 style = "text-align: center">${task.TaskName}<div style="font-size:2vh; color:#ad1313;">Edit Task</div></h1>
                <div class = "form-element">
                    <label for="task">Enter Task Name: </label>
                    <input type="text" id="etask" required placeholder="${task.TaskName}">
                    <label>Pick type of task:</label><br>
                    <label style="font-size: 1.5vh;">(Choose all that applies)</label><br>
                    <input type="checkbox" id="etype1">
                    <label for="type1">Personal</label><br>
                    <input type="checkbox" id="etype2">
                    <label for="type2">Urgent</label><br>
                    <input type="checkbox" id="etype3">
                    <label for="type3">Growth</label><br>
                    <input type="checkbox" id="etype4">
                    <label for="type4">Academics</label><br>
                    <input type="checkbox" id="etype5">
                    <label for="type5">Interactive</label><br>
                    <input type="checkbox" id="etype6">
                    <label for="type6">Social</label><br>
                    <label for="deadLine">Deadline: </label>
                    <input type="date" id="edeadLine"><br>
                    <label for="edescription">Add a description: </label>
                    <textarea id="edescription" rows="3" placeholder="Add a comment..."></textarea>

                    <button type="submit" class="btn">Submit</button>
                    <button type="reset" class="btn">Reset</button>
                </div>
            `
}

//Loads Task
async function loadTasks(searchTask) {
    query = supabaseClient
        .from('Tasks')
        .select('*');

    if (searchTask && searchTask.trim() != "") {
        query = query.ilike('TaskName', `%${searchTask.trim()}%`);
    }

    const { data: tasks, error } = await query

    if (error) {
        console.error('Error fetching tasks from Supabase:', error.message);
        return;
    }

    // Convert database structure to match taskArr objects
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

//Submit Handler
document.getElementById("taskForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let dateInput = document.getElementById("deadLine").value;

    // Insert task
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

    document.querySelector(".popUp").classList.remove("active");
    document.getElementById("taskForm").reset();

    // Rr-Load
    loadTasks();
});

//Edit Handler
document.getElementById("editForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    let dateInput = document.getElementById("edeadLine").value;
    const taskId = this.dataset.taskId;

    // Insert task
    const { data, error } = await supabaseClient
        .from('Tasks')
        .update([
            {
                TaskName: document.getElementById("etask").value,
                Type1: document.getElementById("etype1").checked,
                Type2: document.getElementById("etype2").checked,
                Type3: document.getElementById("etype3").checked,
                Type4: document.getElementById("etype4").checked,
                Type5: document.getElementById("etype5").checked,
                Type6: document.getElementById("etype6").checked,
                Deadline: dateInput || null,
                Description: document.getElementById("edescription").value
            }
        ])
        .eq('id', taskId);

    if (error) {
        console.error("Error inserting task into Supabase:", error.message);
        return;
    }

    //doesn't work yet
    document.querySelector(".popUp2").classList.remove("active2");
    document.getElementById("editForm").reset();

    // Rr-Load
    loadTasks();
});

//Searching for Task
const searchTask = document.getElementById("searchTextId");

searchTask.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
        loadTasks(searchTask.value);
        searchTask.value = "";
    }
});

// Load existing tasks on startup
loadTasks();

//Big Callendar
document.addEventListener('DOMContentLoaded', function () {
    const monthYear = document.getElementById('month-year');
    const daysCont = document.getElementById('days');
    const prevButton = document.getElementById('prev');
    const nextButton = document.getElementById('next');

    let today = new Date();
    function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();

        monthYear.textContent = `${monthsFull[month]} ${year}`;

        daysCont.innerHTML = '';

        //Prev Month
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDay; i > 0; i--) {
            const dayDiv = document.createElement('div');
            dayDiv.textContent = prevMonthLastDay - i + 1;
            dayDiv.classList.add('fade');
            daysCont.appendChild(dayDiv);
        }

        //Current Month
        for (let i = 1; i <= lastDay; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.textContent = i;
            if (i == today.getDate() && month == today.getMonth() && year == today.getFullYear()) {
                dayDiv.classList.add('today');
            }
            daysCont.appendChild(dayDiv);
        }

        //Next Month
        const nextMonthStartDay = 7 - new Date(year, month + 1, 0).getDay() - 1;
        for (let i = 1; i <= nextMonthStartDay; i++) {
            const dayDiv = document.createElement('div');
            dayDiv.textContent = i;
            dayDiv.classList.add('fade');
            daysCont.appendChild(dayDiv);
        }

    }

    prevButton.addEventListener('click', function () {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    })

    nextButton.addEventListener('click', function () {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    })

    renderCalendar(currentDate);
})


//Button Effect of doom
let repeat = false;

document.querySelectorAll("#Calendar").forEach(button => {
    button.onclick = function (e) {
        const calendar = document.getElementById("calendarSection");
        const buttonClicked = e.target.id;

        if (repeat == false) {
            calendar.classList.add("hidden-section");
            document.querySelector("#tasks").classList.add("hidden-section");
            document.querySelector(".calendarBig").classList.remove("hidden-section");
            repeat = true;
        } else {
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
    button.onclick = function (e) {
        const calendar = document.getElementById("calendarSection");
        const buttonClicked = e.target.id;

        if (repeat == false) {
            calendar.classList.add("hidden-section");
            document.querySelector(".calendarBig").classList.add("hidden-section");
            document.querySelector("#tasks").classList.remove("hidden-section");
            repeat = true;
        } else {
            calendar.classList.remove("hidden-section");
            document.querySelector(".calendarBig").classList.add("hidden-section");
            document.querySelector("#tasks").classList.remove("hidden-section");
            repeat = false;
        }
        document.querySelector(".popUp").classList.remove("active");
    };
});

//logIn
const container = document.getElementById('logcontainer');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');

registerBtn.addEventListener('click', () => {
    container.classList.add('active');
})

loginBtn.addEventListener('click', () => {
    container.classList.remove('active');
})

//Registration Function
document.getElementById("regisForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    //Check for duplicate email
    const emailInput = document.getElementById("regisEmail").value;
    document.getElementById("message").classList.remove('error', 'success');

    const { data: existingUser, error: checkError } = await supabaseClient
        .from('Accounts')
        .select('eMail')
        .eq('eMail', emailInput)
        .maybeSingle();

    if (existingUser) {
        document.getElementById("message").innerHTML = `Your email is already registered.`
        document.getElementById("message").classList.add('error');
        document.getElementById("regisForm").reset();
    } else {
        // Add Account
        const { data, error } = await supabaseClient
            .from('Accounts')
            .insert([
                {
                    userName: document.getElementById("regisName").value,
                    eMail: emailInput,
                    password: document.getElementById("regisPassword").value
                }
            ]);

        if (error) {
            document.getElementById("message").innerHTML = `There was a problem crating your account.`
            document.getElementById("message").classList.add('error');
            document.getElementById("regisForm").reset();
            return;
        } else {
            document.getElementById("message").innerHTML = `Account created successfully.`
            document.getElementById("message").classList.add('success');
            document.getElementById("regisForm").reset();
        }
    }
});

//LogIn Function
document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault;

});