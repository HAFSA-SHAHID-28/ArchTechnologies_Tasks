let tasks = JSON.parse(localStorage.getItem('taskly-tasks') || '[]');
let filter = 'all';
let editingId = null;

/* ---------- SAVE ---------- */
function save() {
  localStorage.setItem('taskly-tasks', JSON.stringify(tasks));
}

/* ---------- TOAST ---------- */
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- FILTER ---------- */
function setFilter(f, btn) {
  filter = f;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTasks();
}

/* ---------- ADD TASK ---------- */
function addTask() {
  const input = document.getElementById('taskInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  const priority = document.getElementById('prioritySelect')?.value || 'medium';
  const dueDate = document.getElementById('dueDateInput')?.value || '';

  const task = {
    id: Date.now(),
    text,
    done: false,
    priority,
    dueDate,
    createdAt: new Date().toISOString()
  };

  tasks.unshift(task);
  save();
  input.value = '';

  if (document.getElementById('dueDateInput'))
    document.getElementById('dueDateInput').value = '';

  if (document.getElementById('prioritySelect'))
    document.getElementById('prioritySelect').value = 'medium';

  renderTasks();
  updateStats();
  toast('Task added!');
}

/* ---------- TOGGLE ---------- */
function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;

  t.done = !t.done;
  save();
  renderTasks();
  updateStats();

  if (t.done) toast('Task completed! ✓');
}

/* ---------- DELETE ---------- */
function deleteTask(id) {
  const el = document.getElementById('task-' + id);

  if (el) {
    el.classList.add('completing');
    setTimeout(() => removeTask(id), 350);
  } else {
    removeTask(id);
  }
}

function removeTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  renderTasks();
  updateStats();
  toast('Task removed.');
}

/* ---------- EDIT ---------- */
function startEdit(id) {
  editingId = id;
  renderTasks();

  const inp = document.getElementById('edit-' + id);
  if (inp) {
    inp.focus();
    inp.select();
  }
}

function saveEdit(id) {
  const inp = document.getElementById('edit-' + id);
  if (!inp) return;

  const newText = inp.value.trim();
  if (newText) {
    const t = tasks.find(t => t.id === id);
    if (t) t.text = newText;
    save();
    toast('Task updated.');
  }

  editingId = null;
  renderTasks();
  updateStats();
}

/* ---------- CLEAR ---------- */
function clearCompleted() {
  const count = tasks.filter(t => t.done).length;

  tasks = tasks.filter(t => !t.done);
  save();
  renderTasks();
  updateStats();

  toast(count + ' task' + (count !== 1 ? 's' : '') + ' cleared.');
}

/* ---------- DATE ---------- */
function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toDateString());
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ---------- RENDER ---------- */
function renderTasks() {
  const list = document.getElementById('taskList');
  if (!list) return;

  const searchEl = document.getElementById('searchInput');
  const search = searchEl ? searchEl.value.trim().toLowerCase() : '';

  let filtered = tasks.filter(t => {
    const matchSearch = !search || t.text.toLowerCase().includes(search);
    if (!matchSearch) return false;

    if (filter === 'active') return !t.done;
    if (filter === 'completed') return t.done;
    if (filter === 'high') return t.priority === 'high';

    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>${search ? 'No tasks found' : 'Nothing here — add a task!'}</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const isEditing = editingId === t.id;
    const overdue = !t.done && isOverdue(t.dueDate);

    return `
    <div class="task-item ${t.done ? 'done' : ''}" id="task-${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${t.id})">

      <div class="task-content">
        ${isEditing
        ? `<input id="edit-${t.id}" value="${t.text}" 
                onkeydown="if(event.key==='Enter')saveEdit(${t.id})">`
        : `<div class="task-text">${t.text}</div>`
      }

        ${t.dueDate ? `<small>${formatDate(t.dueDate)}</small>` : ''}
      </div>

      <button onclick="startEdit(${t.id})"><i class="fa-solid fa-pen-to-square icon"></i></button>
      <button onclick="deleteTask(${t.id})"><i class="fa-solid fa-xmark icon"></i></button>
    </div>`;
  }).join('');
}

/* ---------- STATS ---------- */
function updateStats() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const pending = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-done').textContent = done;

  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = pct + '%';

  document.getElementById('footerCount').textContent =
    pending + ' task' + (pending !== 1 ? 's' : '') + ' remaining';

  document.getElementById('clearBtn').disabled = done === 0;
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('taskInput');

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') addTask();
    });
  }

  renderTasks();
  updateStats();
});