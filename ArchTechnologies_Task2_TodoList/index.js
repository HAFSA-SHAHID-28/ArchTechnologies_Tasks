
const taskInput = document.getElementById("taskInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const errorMessage = document.getElementById("errorMessage");
const taskCount = document.getElementById("taskCount");
const clearCompletedBtn = document.getElementById("clearCompleted");
const filterButtons = document.querySelectorAll(".task-filters button");


// STATE

let tasks = JSON.parse(localStorage.getItem("doneviaTasks")) || [];
let currentFilter = "all";


renderTasks();


// ADD TASK
addTaskBtn.addEventListener("click", addTask);
taskInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addTask();
});

function addTask() {
  const text = taskInput.value.trim();

  if (text === "") {
    errorMessage.textContent = "Please enter a task";
    return;
  }

  errorMessage.textContent = "";

  const task = {
    id: Date.now(),
    text,
    completed: false
  };

  tasks.push(task);
  saveTasks();
  renderTasks();

  taskInput.value = "";
}


// TOGGLE COMPLETE

function toggleTask(id) {
  tasks = tasks.map(task =>
    task.id === id ? { ...task, completed: !task.completed } : task
  );
  saveTasks();
  renderTasks();
}


// DELETE TASK

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
}


// CLEAR COMPLETED

clearCompletedBtn.addEventListener("click", () => {
  tasks = tasks.filter(task => !task.completed);
  saveTasks();
  renderTasks();
});


// FILTERS

filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(".task-filters .active").classList.remove("active");
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});


// SAVE TO LOCAL STORAGE

function saveTasks() {
  localStorage.setItem("doneviaTasks", JSON.stringify(tasks));
}

// RENDER TASKS

function renderTasks() {
  taskList.innerHTML = "";

  let filteredTasks = tasks;

  if (currentFilter === "active") {
    filteredTasks = tasks.filter(task => !task.completed);
  } else if (currentFilter === "completed") {
    filteredTasks = tasks.filter(task => task.completed);
  }

  if (filteredTasks.length === 0) {
    taskList.innerHTML = `
      <li class="empty">No tasks found</li>
    `;
  }

  filteredTasks.forEach(task => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;

    li.innerHTML = `
      <label class="task-left">
        <input type="checkbox" ${task.completed ? "checked" : ""} 
        onchange="toggleTask(${task.id})">
        <span>${task.text}</span>
      </label>
      <button class="delete-btn" onclick="deleteTask(${task.id})">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    taskList.appendChild(li);
  });

  updateCount();
}


// TASK COUNT

function updateCount() {
  const activeTasks = tasks.filter(task => !task.completed).length;
  taskCount.textContent = `${activeTasks} task${activeTasks !== 1 ? "s" : ""} left`;
}
