/* Lógica de frontend: todo via fetch() contra la API de FastAPI.
   Sin frameworks, para mantener el prototipo simple de arrancar y de leer. */

const state = {
  date: toISODate(new Date()),
  categories: [],
};

// ---------- Helpers ----------
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Error de red");
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("date-picker").value = state.date;
  updateDateLabel();

  await loadCategories();
  await loadDay();

  bindEvents();
});

function updateDateLabel() {
  document.getElementById("today-label").textContent = formatDateLabel(state.date);
}

function bindEvents() {
  document.getElementById("date-picker").addEventListener("change", async (e) => {
    state.date = e.target.value;
    updateDateLabel();
    await loadDay();
  });

  document.getElementById("prev-day").addEventListener("click", () => shiftDay(-1));
  document.getElementById("next-day").addEventListener("click", () => shiftDay(1));

  document.getElementById("task-form").addEventListener("submit", onAddTask);
  document.getElementById("save-sleep-btn").addEventListener("click", onSaveSleep);

  document.getElementById("quote-input").addEventListener("blur", onSaveEntry);
  document.getElementById("notes-input").addEventListener("blur", onSaveEntry);

  document.querySelectorAll(".mood-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mood-option").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      onSaveEntry();
    });
  });

  document.getElementById("manage-categories-btn").addEventListener("click", openCategoryModal);
  document.getElementById("close-category-modal").addEventListener("click", closeCategoryModal);
  document.getElementById("category-form").addEventListener("submit", onCreateCategory);
}

function shiftDay(delta) {
  const d = new Date(state.date + "T00:00:00");
  d.setDate(d.getDate() + delta);
  state.date = toISODate(d);
  document.getElementById("date-picker").value = state.date;
  updateDateLabel();
  loadDay();
}

// ---------- Categories ----------
async function loadCategories() {
  state.categories = await api("/api/categories");
  renderCategorySelect();
  renderCategoryModalList();
}

function renderCategorySelect() {
  const select = document.getElementById("task-category");
  select.innerHTML = state.categories
    .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
    .join("");
}

function renderCategoryModalList() {
  const list = document.getElementById("category-list");
  if (state.categories.length === 0) {
    list.innerHTML = `<li class="empty-msg">Aún no hay categorías</li>`;
    return;
  }
  list.innerHTML = state.categories
    .map(
      (c) => `
      <li class="category-item" data-id="${c.id}">
        <input type="color" value="${c.color || "#6C5CE7"}" class="cat-color-input">
        <input type="text" value="${escapeHtml(c.name)}" class="cat-name-input">
        <button class="category-item__delete" title="Borrar">🗑</button>
      </li>`
    )
    .join("");

  list.querySelectorAll(".category-item").forEach((li) => {
    const id = li.dataset.id;
    li.querySelector(".cat-name-input").addEventListener("blur", (e) =>
      updateCategory(id, { name: e.target.value })
    );
    li.querySelector(".cat-color-input").addEventListener("change", (e) =>
      updateCategory(id, { color: e.target.value })
    );
    li.querySelector(".category-item__delete").addEventListener("click", () => deleteCategory(id));
  });
}

async function onCreateCategory(e) {
  e.preventDefault();
  const nameInput = document.getElementById("category-name");
  const colorInput = document.getElementById("category-color");
  try {
    await api("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: nameInput.value, color: colorInput.value }),
    });
    nameInput.value = "";
    await loadCategories();
  } catch (err) {
    alert(err.message);
  }
}

async function updateCategory(id, payload) {
  try {
    await api(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    await loadCategories();
    await loadDay(); // los nombres/colores pueden haber cambiado en las tareas visibles
  } catch (err) {
    alert(err.message);
  }
}

async function deleteCategory(id) {
  if (!confirm("¿Borrar esta categoría?")) return;
  try {
    await api(`/api/categories/${id}`, { method: "DELETE" });
    await loadCategories();
  } catch (err) {
    alert(err.message);
  }
}

function openCategoryModal() {
  document.getElementById("category-modal").classList.remove("hidden");
}
function closeCategoryModal() {
  document.getElementById("category-modal").classList.add("hidden");
}

// ---------- Day summary (tasks + sleep + entry) ----------
async function loadDay() {
  const summary = await api(`/api/summary/${state.date}`);
  renderTasks(summary.tasks, summary.total_minutes);
  renderSleep(summary.sleep);
  renderEntry(summary.entry);
}

// ---------- Tasks ----------
function renderTasks(tasks, totalMinutes) {
  document.getElementById("total-minutes").textContent = `${totalMinutes} min`;
  const list = document.getElementById("task-list");

  if (tasks.length === 0) {
    list.innerHTML = `<li class="empty-msg">Sin tareas registradas todavía hoy</li>`;
    return;
  }

  list.innerHTML = tasks
    .map(
      (t) => `
      <li class="task-item" data-id="${t.id}">
        <span class="task-dot" style="background:${t.category.color || "#999"}"></span>
        <span class="task-item__name">${escapeHtml(t.name)}</span>
        <span class="task-item__cat">${escapeHtml(t.category.name)}</span>
        <span class="task-item__minutes">${t.minutes} min</span>
        <button class="task-item__delete" title="Borrar">✕</button>
      </li>`
    )
    .join("");

  list.querySelectorAll(".task-item__delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.closest(".task-item").dataset.id;
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      await loadDay();
    });
  });
}

async function onAddTask(e) {
  e.preventDefault();
  const categoryId = document.getElementById("task-category").value;
  const name = document.getElementById("task-name").value;
  const minutes = document.getElementById("task-minutes").value;

  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        date: state.date,
        name,
        minutes: Number(minutes),
        category_id: Number(categoryId),
      }),
    });
    document.getElementById("task-name").value = "";
    document.getElementById("task-minutes").value = "";
    await loadDay();
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Sleep ----------
function renderSleep(sleep) {
  document.getElementById("sleep-time").value = sleep?.sleep_time?.slice(0, 5) || "";
  document.getElementById("wake-time").value = sleep?.wake_time?.slice(0, 5) || "";
  document.getElementById("light-pct").value = sleep?.light_pct ?? "";
  document.getElementById("deep-pct").value = sleep?.deep_pct ?? "";
  document.getElementById("rem-pct").value = sleep?.rem_pct ?? "";
  document.getElementById("sleep-saved-msg").classList.add("hidden");
}

async function onSaveSleep() {
  const payload = {
    date: state.date,
    sleep_time: valueOrNull("sleep-time"),
    wake_time: valueOrNull("wake-time"),
    light_pct: numberOrNull("light-pct"),
    deep_pct: numberOrNull("deep-pct"),
    rem_pct: numberOrNull("rem-pct"),
  };
  try {
    await api("/api/sleep", { method: "PUT", body: JSON.stringify(payload) });
    const msg = document.getElementById("sleep-saved-msg");
    msg.classList.remove("hidden");
    setTimeout(() => msg.classList.add("hidden"), 2000);
  } catch (err) {
    alert(err.message);
  }
}

// ---------- Daily entry (quote, mood, notes) ----------
function renderEntry(entry) {
  document.getElementById("quote-input").value = entry?.quote || "";
  document.getElementById("notes-input").value = entry?.notes || "";
  document.querySelectorAll(".mood-option").forEach((b) => b.classList.remove("selected"));
  if (entry?.mood) {
    const btn = document.querySelector(`.mood-option[data-mood="${entry.mood}"]`);
    if (btn) btn.classList.add("selected");
  }
}

async function onSaveEntry() {
  const selectedMoodBtn = document.querySelector(".mood-option.selected");
  const payload = {
    date: state.date,
    quote: document.getElementById("quote-input").value || null,
    notes: document.getElementById("notes-input").value || null,
    mood: selectedMoodBtn ? Number(selectedMoodBtn.dataset.mood) : null,
  };
  try {
    await api("/api/daily", { method: "PUT", body: JSON.stringify(payload) });
  } catch (err) {
    console.error(err);
  }
}

// ---------- utils ----------
function valueOrNull(id) {
  const v = document.getElementById(id).value;
  return v === "" ? null : v;
}
function numberOrNull(id) {
  const v = document.getElementById(id).value;
  return v === "" ? null : Number(v);
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
