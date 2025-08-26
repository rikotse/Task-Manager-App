let currentTheme = 'light';

// 🔔 Ask user for browser notification permission
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

// Get DOM elements
const taskInput = document.getElementById("taskInput");
const dueDateInput = document.getElementById("dueDateInput");
const dueTimeInput = document.getElementById("dueTimeInput");
const priorityInput = document.getElementById("priorityInput");
const addTaskBtn = document.getElementById("addTaskBtn");
const taskList = document.getElementById("taskList");
const calendarGrid = document.getElementById("calendarGrid");
const filterDateInput = document.getElementById("filterDate");
const datePicker = document.getElementById("datePicker");
let currentFilter = "all";
let filterDate = null;

// Global tasks array - fetched from backend
let tasks = [];

const API_BASE = "http://127.0.0.1:5000/api/tasks";

// Theme toggle functionality
function toggleTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const icon = themeToggle.querySelector('i');
  
  if (currentTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'dark');
    currentTheme = 'dark';
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    document.documentElement.removeAttribute('data-theme');
    currentTheme = 'light';
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }

  // Save theme preference to localStorage
  localStorage.setItem('theme', currentTheme);
}

// Fetch all tasks from backend API
async function fetchTasks() {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = "";

  // Add loading state
  taskList.innerHTML = `
    <div class="empty-state">
      <div class="loading-spinner"></div>
      <p>Loading tasks...</p>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    tasks = await res.json();
    renderTasks();
    renderCalendar();
    updateTaskCount();
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    showNotification("Could not connect to the backend. Please check if the server is running.", 'error');
    taskList.innerHTML = '<div class="empty-state">Unable to load tasks</div>';
  }
}

// Render all tasks with filtering applied
function renderTasks() {
  taskList.innerHTML = "";

  let filteredTasks = [...tasks];

  if (filteredTasks.length === 0) {
    let message = "No tasks";
    if (currentFilter === "active") message = "No active tasks";
    if (currentFilter === "completed") message = "No completed tasks";
    if (filterDate) message = `No tasks due on ${filterDate}`;

    taskList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>${message}</p>
      </div>
    `;
    return;
  }

  if (currentFilter === "active") {
    filteredTasks = filteredTasks.filter((t) => !t.completed);
  } else if (currentFilter === "completed") {
    filteredTasks = filteredTasks.filter((t) => t.completed);
  }

  if (filterDate) {
    filteredTasks = filteredTasks.filter((t) => t.dueDate === filterDate);
  }

  filteredTasks.forEach((task) => {
    const today = new Date().toISOString().split("T")[0];
    if (task.dueDate === today && !task.completed) {
      sendReminder(task);
    }

    const taskItem = document.createElement("div");
    taskItem.className =
      "task-item" +
      (task.completed ? " completed" : "") +
      (isOverdue(task.dueDate, task.dueTime) && !task.completed ? " overdue" : "");

    taskItem.innerHTML = `
      <div class="task-content">
        <div class="task-text">${task.text}</div>
        <div class="task-meta">
          ${
            task.dueDate
              ? `<div class="due-date">
                  <i class="far fa-calendar"></i> Due: ${formatDate(task.dueDate)}
                  ${task.dueTime ? `<span class="time-badge"><i class="far fa-clock"></i> ${formatTime(task.dueTime)}</span>` : ''}
                  <span class="countdown">${getCountdown(task.dueDate, task.dueTime)}</span>
                </div>`
              : ""
          }
          ${
            task.priority
              ? `<span class="priority ${task.priority}">
                  <i class="fas fa-flag"></i> ${task.priority}
                </span>`
              : ""
          }
        </div>
      </div>
      <div class="task-actions">
        <button class="task-btn complete-btn" onclick="toggleComplete(${task.id})" title="${task.completed ? 'Undo complete' : 'Complete task'}">
          <i class="fas ${task.completed ? 'fa-undo' : 'fa-check'}"></i>
        </button>
        <button class="task-btn edit-btn" onclick="editTask(${task.id})" title="Edit task">
          <i class="fas fa-edit"></i>
        </button>
        <button class="task-btn delete-btn" onclick="deleteTask(${task.id})" title="Delete task">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    taskList.appendChild(taskItem);
  });
}

// Format date to more readable format
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Format time to 12-hour format
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
}

// Add new task via API
async function addTask() {
  const taskText = taskInput.value.trim();
  const dueDate = dueDateInput.value;
  const dueTime = dueTimeInput.value;
  const priority = priorityInput.value;

  if (taskText === "") {
    // Visual feedback for empty task
    taskInput.style.borderColor = "var(--danger)";
    setTimeout(() => {
      taskInput.style.borderColor = "var(--border)";
    }, 1000);
    return;
  }

  try {
    const response = await fetch(`${API_BASE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: taskText, dueDate, dueTime, priority }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    taskInput.value = "";
    dueDateInput.value = "";
    dueTimeInput.value = "";
    priorityInput.value = "medium";

    await fetchTasks();
    showNotification('Task added successfully!', 'success');
  } catch (error) {
    console.error("Failed to add task:", error);
    showNotification(`Failed to add task: ${error.message}`, 'error');
  }
}

// Delete task by id via API
async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/${taskId}`, { 
      method: "DELETE" 
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    await fetchTasks();
    showNotification('Task deleted successfully!', 'success');
  } catch (error) {
    console.error("Failed to delete task:", error);
    showNotification(`Failed to delete task: ${error.message}`, 'error');
  }
}

// Toggle task completion and update via API
async function toggleComplete(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const updatedTask = {...task, completed: !task.completed};
  await updateTask(taskId, updatedTask);
}

// Edit task fields and update via API
async function editTask(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  const newText = prompt("Edit your task:", task.text);
  if (newText === null) return;

  const newDate = prompt("Edit due date (YYYY-MM-DD):", task.dueDate || "");
  if (newDate === null) return;

  const newTime = prompt("Edit due time (HH:MM):", task.dueTime || "");
  if (newTime === null) return;

  const newPriority = prompt(
    "Edit priority (low, medium, high):",
    task.priority || "medium"
  );
  if (newPriority === null) return;

  if (newText.trim() === "") return;

  if (!["low", "medium", "high"].includes(newPriority)) {
    alert("Priority must be low, medium, or high.");
    return;
  }

  const updatedTask = {
    ...task,
    text: newText.trim(),
    dueDate: newDate,
    dueTime: newTime,
    priority: newPriority
  };

  await updateTask(taskId, updatedTask);
}

// Update task via API
async function updateTask(taskId, task) {
  try {
    const response = await fetch(`${API_BASE}/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    await fetchTasks();
    showNotification('Task updated successfully!', 'success');
  } catch (error) {
    console.error("Failed to update task:", error);
    showNotification(`Failed to update task: ${error.message}`, 'error');
  }
}

// Handle filtering
function filterTasks(filterType) {
  currentFilter = filterType;

  // Update button states
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
    btn.classList.remove("active");
  });

  event.target.setAttribute("aria-pressed", "true");
  event.target.classList.add("active");

  renderTasks();
}

// Clear date filter
function clearDateFilter() {
  filterDate = null;
  if (filterDateInput) filterDateInput.value = "";
  renderTasks();
}

// Send browser notification reminder
function sendReminder(task) {
  if ("Notification" in window && Notification.permission === "granted") {
    const timeText = task.dueTime ? ` at ${formatTime(task.dueTime)}` : '';
    new Notification("⏰ Task Reminder", {
      body: `"${task.text}" is due today${timeText}!`,
      icon: "https://cdn-icons-png.flaticon.com/512/1828/1828919.png",
    });
  }
}

// Countdown helper
function getCountdown(dueDate, dueTime) {
  if (!dueDate) return "";
  
  const now = new Date();
  let due = new Date(dueDate);
  
  // Add time if specified
  if (dueTime) {
    const [hours, minutes] = dueTime.split(':');
    due.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }
  
  const diffTime = due - now;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 1) return `(${diffDays} days left)`;
  if (diffDays === 1) return `(Due tomorrow)`;
  if (diffDays === 0 && diffHours > 0) return `(Due in ${diffHours}h ${diffMinutes}m)`;
  if (diffDays === 0 && diffHours === 0 && diffMinutes > 0) return `(Due in ${diffMinutes}m)`;
  if (diffDays === 0 && diffHours === 0 && diffMinutes === 0) return `(Due now!)`;
  if (diffTime < 0) return `(Overdue)`;
}

// Render calendar weekly view
function renderCalendar() {
  if (!calendarGrid) return;
  
  calendarGrid.innerHTML = "";

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + i);
    const dateStr = dayDate.toISOString().split("T")[0];
    const isToday = dateStr === today.toISOString().split("T")[0];

    const dayTasks = tasks.filter((task) => task.dueDate === dateStr);

    const dayColumn = document.createElement("div");
    dayColumn.className = `calendar-day ${isToday ? "today" : ""}`;
    dayColumn.onclick = () => {
      filterDate = dateStr;
      if (filterDateInput) filterDateInput.value = dateStr;
      renderTasks();
    };

    const dateLabel = `${daysOfWeek[i]} ${dayDate.getDate()}/${dayDate.getMonth() + 1}`;
    dayColumn.innerHTML = `<h3>${dateLabel}</h3>`;

    if (dayTasks.length === 0) {
      dayColumn.innerHTML += `<p class="text-center" style="color:var(--text-light); font-size:12px;">No tasks</p>`;
    } else {
      dayTasks.forEach((task) => {
        const taskDiv = document.createElement("div");
        taskDiv.className = `calendar-task ${task.priority} ${task.completed ? "completed" : ""}`;
        
        let timeText = '';
        if (task.dueTime) {
          timeText = `<div class="task-time"><i class="far fa-clock"></i> ${formatTime(task.dueTime)}</div>`;
        }
        
        taskDiv.innerHTML = `
          <span>${task.text}</span>
          ${timeText}
          ${task.completed ? "<i class='fas fa-check'></i>" : ""}
        `;
        dayColumn.appendChild(taskDiv);
      });
    }

    calendarGrid.appendChild(dayColumn);
  }
}

// Overdue check
function isOverdue(dueDate, dueTime) {
  if (!dueDate) return false;
  
  const now = new Date();
  const due = new Date(dueDate);
  
  // Add time if specified
  if (dueTime) {
    const [hours, minutes] = dueTime.split(':');
    due.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }
  
  return due < now;
}

// Update task count display
function updateTaskCount() {
  const taskCount = document.getElementById('taskCount');
  if (!taskCount) return;
  
  const activeTasks = tasks.filter(task => !task.completed).length;
  const totalTasks = tasks.length;
  
  taskCount.textContent = `${activeTasks} active of ${totalTasks} tasks`;
}

// Show notification
function showNotification(message, type = 'info') {
  const notificationArea = document.getElementById('notificationArea');
  if (!notificationArea) return;
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  if (type === 'warning') icon = 'fa-exclamation-triangle';
  
  notification.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  notificationArea.appendChild(notification);
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideInRight 0.4s ease reverse';
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 400);
    }
  }, 5000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  fetchTasks();
  
  // Add event listeners
  if (addTaskBtn) {
    addTaskBtn.addEventListener("click", function(e) {
      e.preventDefault();
      addTask();
    });
  }

  if (filterDateInput) {
    filterDateInput.addEventListener("change", (e) => {
      filterDate = e.target.value;
      renderTasks();
    });
  }

  if (taskInput) {
    taskInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addTask();
      }
    });
  }

  if (datePicker) {
    datePicker.addEventListener("change", (e) => {
      const selectedDate = e.target.value;
      renderTasksByDate(selectedDate);
    });
  }
});

// Render tasks due on a selected date
function renderTasksByDate(date) {
  const list = document.getElementById("dateTasksList");
  if (!list) return;

  list.innerHTML = "";
  const filteredTasks = tasks.filter((task) => task.dueDate === date);

  if (filteredTasks.length === 0) {
    list.innerHTML = `<p style="color:var(--text-light);">No tasks due on this date.</p>`;
    return;
  }

  filteredTasks.forEach((task) => {
    const item = document.createElement("div");
    item.className = `date-task-item ${task.priority}`;
    
    let timeText = '';
    if (task.dueTime) {
      timeText = `<br/><i class="far fa-clock"></i> Time: ${formatTime(task.dueTime)}`;
    }
    
    item.innerHTML = `
      <strong>${task.text}</strong><br/>
      <i class="far fa-calendar"></i> Due: ${task.dueDate}
      ${timeText}
      <br/><i class="fas fa-flag"></i> Priority: ${task.priority}
    `;
    list.appendChild(item);
  });
}

// Initialize theme from localStorage
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const themeToggle = document.getElementById('themeToggle');
  
  if (savedTheme === 'dark') {
    toggleTheme();
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}