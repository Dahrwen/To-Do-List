// Global Variable
let accountID;

// Registration Function
document.getElementById("regisForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const emailInput = document.getElementById("regisEmail").value;
    const regMessageEl = document.getElementById("regmessage");

    if (regMessageEl) regMessageEl.classList.remove('error', 'success');

    const { data: existingUser, error: checkError } = await supabaseClient
        .from('Accounts')
        .select('eMail')
        .eq('eMail', emailInput)
        .maybeSingle();

    if (existingUser) {
        if (regMessageEl) {
            regMessageEl.innerHTML = `Your email is already registered.`;
            regMessageEl.classList.add('error');
        }
        document.getElementById("regisForm").reset();
    } else {
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
            if (regMessageEl) {
                regMessageEl.innerHTML = `There was a problem creating your account.`;
                regMessageEl.classList.add('error');
            }
            document.getElementById("regisForm").reset();
            return;
        } else {
            if (regMessageEl) {
                regMessageEl.innerHTML = `Account created successfully.`;
                regMessageEl.classList.add('success');
            }
            document.getElementById("regisForm").reset();
        }
    }
});

// LogIn Function
document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    let logEmail = document.getElementById("logEmail").value;
    let logPass = document.getElementById("logPass").value;

    const logMessageEl = document.getElementById("logmessage");
    if (logMessageEl) logMessageEl.classList.remove('error', 'success');

    const { data: user, error } = await supabaseClient
        .from('Accounts')
        .select('*')
        .eq('eMail', logEmail)
        .eq('password', logPass)
        .maybeSingle();

    if (error) {
        if (logMessageEl) {
            logMessageEl.innerHTML = `There was an error checking your account.`;
            logMessageEl.classList.add('error');
        }
        document.getElementById("loginForm").reset();
        return;
    }

    if (!user) {
        if (logMessageEl) {
            logMessageEl.innerHTML = `Invalid Email or Password.`;
            logMessageEl.classList.add('error');
        }
        document.getElementById("loginForm").reset();
        return;
    }

    logMessageEl.innerHTML = ``;
    accountID = user.userID;

    loadTasks();
    minicalendar();
    window.renderCalendar(currentDate);

    document.getElementById("logcontainer").classList.add('hide');
    document.getElementById("websiteCont").classList.remove("locked-content");
    document.getElementById("accountName").innerHTML = `${user.userName}`;
    document.getElementById("loginForm").reset();
});

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const monthsFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
let currentDate = new Date();

async function minicalendar() {
    let tasks = [];
    if (accountID) {
        const { data, error } = await supabaseClient
            .from('Tasks')
            .select('*')
            .eq('userID', accountID);

        if (error) {
            console.error("Error fetching tasks:", error);
            return;
        }
        tasks = data || [];
    }

    const daytask = Array.from({ length: 14 }, () => []);

    for (let x = 0; x < 14; x++) {
        let d = new Date();
        d.setDate(currentDate.getDate() + x);

        const formattedDate = d.toISOString().split('T')[0];

        tasks.forEach(t => {
            const taskDeadline = new Date(t.Deadline).toISOString().split('T')[0];

            if (formattedDate === taskDeadline) {
                daytask[x].push(t.TaskName);
            }
        });
    }

    const formattedDayTasks = daytask.map(taskList => {
        if (taskList.length === 0) return '';

        if (taskList.length > 3) {
            const topThree = taskList.slice(0, 3);
            topThree[2] += '...';
            return topThree.join('<br>');
        }

        return taskList.join('<br>');
    });

    const datesContainer = document.getElementById("dates");
    datesContainer.innerHTML = "";

    for (let x = 0; x < 14; x++) {
        let d = new Date();
        d.setDate(currentDate.getDate() + x);

        datesContainer.innerHTML += `
            <li class="card">
                <h2>${dayNames[d.getDay()]}</h2>
                <h4>${months[d.getMonth()]} ${d.getDate()}</h4>
                <p style="font-size: 15px; margin-top 5px;">${formattedDayTasks[x]}</p>
            </li>
        `;
    }
}

const carousel = document.querySelector(".carousel");
const arrowBtns = document.querySelectorAll(".wrapper b");

let isDragging = false, startX, startScrollLeft;

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
    startX = e.pageX;
    startScrollLeft = carousel.scrollLeft;
}

const dragging = (e) => {
    if (!isDragging) return;
    carousel.scrollLeft = startScrollLeft - (e.pageX - startX);
}

const dragStop = () => {
    isDragging = false;
    carousel.classList.remove("dragging");
}
carousel.addEventListener("mousedown", dragStart);
carousel.addEventListener("mousemove", dragging);
document.addEventListener("mouseup", dragStop);

// popUp buttons
document.querySelector("#addTask").addEventListener("click", function () {
    document.querySelector(".popUp").classList.add("active");
    document.querySelector(".popUp2").classList.remove("active2");
    document.querySelector(".popUpDesc").classList.remove("activeDesc");
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

const taskTypes = ["Personal", "Urgent", "Growth", "Academics", "Interactive", "Social"];
let taskArr = [];

// Attach click listener ONCE outside of render function
const tasksContainer = document.getElementById("tasks");
tasksContainer.addEventListener("click", function (event) {
    const taskItem = event.target.closest(".taskList");
    if (taskItem) {
        document.querySelector(".popUpDesc").classList.add("activeDesc");
        let taskId = taskItem.dataset.id;
        document.querySelector(".popUp").classList.remove("active");
        taskDesc(taskId);
    }
});

// Function to render tasks array into HTML
function renderTasksUI() {
    tasksContainer.innerHTML = "";

    taskArr.forEach(task => {
        let categoriesToDisplay = [...task.categories];

        if (categoriesToDisplay.length > 2) {
            categoriesToDisplay = categoriesToDisplay.slice(0, 2);
            categoriesToDisplay[3] = '...';
        }

        const categoryHTML = categoriesToDisplay
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

async function taskDesc(taskId) {
    if (!accountID) return;

    const { data: tasks, error } = await supabaseClient
        .from('Tasks')
        .select('*')
        .eq('id', taskId)
        .eq('userID', accountID);

    if (!tasks || tasks.length === 0) return;
    const task = tasks[0];

    const currentTaskInArr = taskArr.find(t => t.id == taskId);

    const categoryHTML = currentTaskInArr?.categories
        ?.map(cat => `<li style="font-size: 2.5vh" class="${cat}">${cat}</li>`)
        .join('') || '';

    let Description = !task.Description ? "Edit to add description" : task.Description;
    let Deadline = !task.Deadline ? "No Due Date" : task.Deadline;

    document.getElementById("taskDesc").innerHTML = `
            <h1 style = "text-align: center">Task Details</h1>
            <p><b>Task Name: </b>${task.TaskName}</p>
            <ul>${categoryHTML}</ul>
            <p><b>Deadline: </b>${Deadline}</p>
            <b>Task Description:</b>
            <p style="font-size:2vh">${Description}</p>
            <button class="eButton" id="editButton">Edit</button>
            <img id="delete" style="height: clamp(26px, 4vh, 34px); position: absolute; bottom: 20px; right: 24px; cursor: pointer;" src="Pictures/TrashCan.png">
            `;
    document.getElementById("delete").addEventListener("click", function (e) {
        e.preventDefault();
        deleteTask(taskId)
    });

    document.getElementById("editButton").addEventListener("click", function (e) {
        e.preventDefault();
        document.querySelector(".popUp2").classList.add("active2");
        document.querySelector(".popUpDesc").classList.remove("activeDesc");
        editTask(taskId);
    }, { once: true });
}

async function editTask(taskId) {
    if (!accountID) return;

    const { data: tasks, error } = await supabaseClient
        .from('Tasks')
        .select('*')
        .eq('id', taskId)
        .eq('userID', accountID);

    if (!tasks || tasks.length === 0) return;
    const task = tasks[0];

    const editForm = document.getElementById("editForm");
    editForm.dataset.taskId = taskId;

    editForm.innerHTML = `
                <h1 style = "text-align: center">${task.TaskName}<div style="font-size:2vh; color:#ad1313;">Edit Task</div></h1>
                <div class = "form-element">
                    <label for="task">Enter Task Name: </label>
                    <input type="text" id="etask" required placeholder="${task.TaskName}">
                    <label>Pick type of task:</label><br>
                    <label style="font-size: 1.5vh;">(Choose all that applies)</label><br>
                    <input type="checkbox" id="etype1" ${task.Type1 ? 'checked' : ''}>
                    <label for="etype1">Personal</label><br>
                    <input type="checkbox" id="etype2" ${task.Type2 ? 'checked' : ''}>
                    <label for="etype2">Urgent</label><br>
                    <input type="checkbox" id="etype3" ${task.Type3 ? 'checked' : ''}>
                    <label for="etype3">Growth</label><br>
                    <input type="checkbox" id="etype4" ${task.Type4 ? 'checked' : ''}>
                    <label for="etype4">Academics</label><br>
                    <input type="checkbox" id="etype5" ${task.Type5 ? 'checked' : ''}>
                    <label for="etype5">Interactive</label><br>
                    <input type="checkbox" id="etype6" ${task.Type6 ? 'checked' : ''}>
                    <label for="etype6">Social</label><br>
                    <label for="edeadLine">Deadline: </label>
                    <input type="date" id="edeadLine" value="${task.Deadline || ''}"><br>
                    <label for="edescription">Add a description: </label>
                    <textarea id="edescription" rows="3" placeholder="Add a comment...">${task.Description || ''}</textarea>

                    <button type="submit" class="btn">Submit</button>
                    <button type="reset" class="btn">Reset</button>
                </div>
            `;
}

// Loads Task
async function loadTasks(searchTask) {
    // Prevent fetching if accountID is not populated
    if (!accountID) return;

    let query = supabaseClient
        .from('Tasks')
        .select('*')
        .eq('userID', accountID);

    if (searchTask && searchTask.trim() != "") {
        query = query.ilike('TaskName', `%${searchTask.trim()}%`);
    }

    const { data: tasks, error } = await query;

    if (error) {
        console.error('Error fetching tasks from Supabase:', error.message);
        return;
    }

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

// Submit Handler
document.getElementById("taskForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!accountID) {
        alert("Please log in first before creating tasks!");
        return;
    }

    let dateInput = document.getElementById("deadLine").value;

    const { data, error } = await supabaseClient
        .from('Tasks')
        .insert([
            {
                userID: accountID,
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
    loadTasks();
    minicalendar();
    window.renderCalendar(currentDate);
});

// Edit Handler
document.getElementById("editForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!accountID) return;

    let dateInput = document.getElementById("edeadLine").value;
    const taskId = this.dataset.taskId;

    const { data, error } = await supabaseClient
        .from('Tasks')
        .update({
            TaskName: document.getElementById("etask").value,
            Type1: document.getElementById("etype1").checked,
            Type2: document.getElementById("etype2").checked,
            Type3: document.getElementById("etype3").checked,
            Type4: document.getElementById("etype4").checked,
            Type5: document.getElementById("etype5").checked,
            Type6: document.getElementById("etype6").checked,
            Deadline: dateInput || null,
            Description: document.getElementById("edescription").value
        })
        .eq('id', taskId)
        .eq('userID', accountID);

    if (error) {
        console.error("Error updating task in Supabase:", error.message);
        return;
    }

    document.querySelector(".popUp2").classList.remove("active2");
    document.getElementById("editForm").reset();
    loadTasks();
    minicalendar();
    window.renderCalendar(currentDate);
});

// Searching for Task
const searchTask = document.getElementById("searchTextId");
if (searchTask) {
    searchTask.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            loadTasks(searchTask.value);
            searchTask.value = "";
        }
    });
}

async function deleteTask(taskId) {
    const { data: tasks, error } = await supabaseClient
        .from('Tasks')
        .delete()
        .eq('id', taskId)
        .eq('userID', accountID);

    loadTasks();
    minicalendar();
    window.renderCalendar(currentDate);
    document.querySelector(".popUpDesc").classList.remove("activeDesc");
}


//Big Calendar
document.addEventListener('DOMContentLoaded', function () {
    const monthYear = document.getElementById('month-year');
    const daysCont = document.getElementById('days');
    const prevButton = document.getElementById('prev');
    const nextButton = document.getElementById('next');

    let today = new Date();

    // Make window-accessible so login handlers can re-trigger it
    window.renderCalendar = async function (date) {
        let tasks = [];
        if (typeof accountID !== 'undefined' && accountID) {
            const { data, error } = await supabaseClient
                .from('Tasks')
                .select('*')
                .eq('userID', accountID);

            if (!error && data) {
                tasks = data;
            }
        }

        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDay = new Date(year, month + 1, 0).getDate();

        if (monthYear) monthYear.textContent = `${monthsFull[month]} ${year}`;
        if (!daysCont) return;

        daysCont.innerHTML = '';

        const getTasksForDate = (checkDate) => {
            // Local date formatting (YYYY-MM-DD) avoiding timezone shifts
            const yyyy = checkDate.getFullYear();
            const mm = String(checkDate.getMonth() + 1).padStart(2, '0');
            const dd = String(checkDate.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            const taskList = [];
            tasks.forEach(t => {
                if (!t.Deadline) return;
                const taskDeadline = t.Deadline.split('T')[0];
                if (formattedDate === taskDeadline) {
                    taskList.push(t.TaskName);
                }
            });

            if (taskList.length === 0) return '';

            // Cap at 2 tasks + append '...' if there are more
            if (taskList.length > 2) {
                const topTwo = taskList.slice(0, 2);
                topTwo[1] += '...';
                return topTwo.join('<br>');
            }

            return taskList.join('<br>');
        };

        // Prev Month Days
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDay; i > 0; i--) {
            const dayNum = prevMonthLastDay - i + 1;
            const checkDate = new Date(year, month - 1, dayNum);

            const dayDiv = document.createElement('div');
            dayDiv.classList.add('fade');
            dayDiv.innerHTML = `
                <span>${dayNum}</span>
                <p style="font-size: 12px; margin-top: 5px;">${getTasksForDate(checkDate)}</p>
            `;
            daysCont.appendChild(dayDiv);
        }

        // Current Month Days
        for (let i = 1; i <= lastDay; i++) {
            const checkDate = new Date(year, month, i);

            const dayDiv = document.createElement('div');
            if (i == today.getDate() && month == today.getMonth() && year == today.getFullYear()) {
                dayDiv.classList.add('today');
            }

            dayDiv.innerHTML = `
                <span>${i}</span>
                <p style="font-size: 12px; margin-top: 5px;">${getTasksForDate(checkDate)}</p>
            `;
            daysCont.appendChild(dayDiv);
        }

        // Next Month Days
        const nextMonthStartDay = 7 - new Date(year, month + 1, 0).getDay() - 1;
        for (let i = 1; i <= nextMonthStartDay; i++) {
            const checkDate = new Date(year, month + 1, i);

            const dayDiv = document.createElement('div');
            dayDiv.classList.add('fade');
            dayDiv.innerHTML = `
                <span>${i}</span>
                <p style="font-size: 12px; margin-top: 5px;">${getTasksForDate(checkDate)}</p>
            `;
            daysCont.appendChild(dayDiv);
        }
    };

    if (prevButton) {
        prevButton.addEventListener('click', function () {
            currentDate.setMonth(currentDate.getMonth() - 1);
            window.renderCalendar(currentDate);
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', function () {
            currentDate.setMonth(currentDate.getMonth() + 1);
            window.renderCalendar(currentDate);
        });
    }

    window.renderCalendar(currentDate);
});
// Section Toggles
let repeat = false;

document.querySelectorAll("#Calendar").forEach(button => {
    button.onclick = function (e) {
        const calendar = document.getElementById("calendarSection");

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
        document.querySelector(".popUpDesc").classList.remove("activeDesc");
        document.querySelector(".popUp2").classList.remove("active2");
    };
});

document.querySelectorAll("#todo").forEach(button => {
    button.onclick = function (e) {
        const calendar = document.getElementById("calendarSection");

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
        document.querySelector(".popUpDesc").classList.remove("activeDesc");
        document.querySelector(".popUp2").classList.remove("active2");
    };
});

// LogIn / Register Toggles
const container = document.getElementById('logcontainer');
const registerBtn = document.getElementById('register');
const loginBtn = document.getElementById('login');

if (registerBtn && container) {
    registerBtn.addEventListener('click', () => {
        container.classList.add('active');
    });
}

if (loginBtn && container) {
    loginBtn.addEventListener('click', () => {
        container.classList.remove('active');
    });
}

minicalendar();
window.renderCalendar(currentDate);