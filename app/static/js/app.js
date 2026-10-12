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

// ---------- Toasts (reemplazan alert()) ----------
function showToast(message, type = "default") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast--error" : type === "success" ? "toast--success" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// ---------- Confirm modal (reemplaza confirm()) ----------
function confirmAction(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirm-modal");
    document.getElementById("confirm-message").textContent = message;
    modal.classList.remove("hidden");

    const cleanup = (result) => {
      modal.classList.add("hidden");
      acceptBtn.removeEventListener("click", onAccept);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onAccept = () => cleanup(true);
    const onCancel = () => cleanup(false);

    const acceptBtn = document.getElementById("confirm-accept");
    const cancelBtn = document.getElementById("confirm-cancel");
    acceptBtn.addEventListener("click", onAccept);
    cancelBtn.addEventListener("click", onCancel);
  });
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("date-picker").value = state.date;
  updateDateLabel();

  await loadCategories();
  await loadDay();
  await loadStreak();

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

  // Chips de minutos rápidos
  document.getElementById("minute-chips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    chip.classList.add("selected");
    document.getElementById("task-minutes").value = chip.dataset.minutes;
  });
  // Si el usuario escribe un valor manual, deseleccionamos los chips
  document.getElementById("task-minutes").addEventListener("input", (e) => {
    const chips = document.querySelectorAll(".chip");
    const matching = [...chips].find((c) => c.dataset.minutes === e.target.value);
    chips.forEach((c) => c.classList.toggle("selected", c === matching));
  });

  // Cerrar modales con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeCategoryModal();
  });
}

function shiftDay(delta) {
  const d = new Date(state.date + "T00:00:00");
  d.setDate(d.getDate() + delta);
  state.date = toISODate(d);
  document.getElementById("date-picker").value = state.date;
  updateDateLabel();
  loadDay();
}

// ---------- Streak ----------
async function loadStreak() {
  try {
    const { streak } = await api("/api/stats/streak");
    const badge = document.getElementById("streak-badge");
    if (streak > 0) {
      badge.textContent = `🔥 ${streak} ${streak === 1 ? "día" : "días"} seguidos`;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
  }
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
        <button class="category-item__delete" title="Borrar" type="button">🗑</button>
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
    showToast("Categoría creada", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function updateCategory(id, payload) {
  try {
    await api(`/api/categories/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    await loadCategories();
    await loadDay(); // los nombres/colores pueden haber cambiado en las tareas visibles
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteCategory(id) {
  const ok = await confirmAction("¿Borrar esta categoría? Esta acción no se puede deshacer.");
  if (!ok) return;
  try {
    await api(`/api/categories/${id}`, { method: "DELETE" });
    await loadCategories();
    showToast("Categoría borrada", "success");
  } catch (err) {
    showToast(err.message, "error");
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
  renderCategoryBreakdown(summary.tasks, summary.total_minutes);
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
        <button class="task-item__delete" title="Borrar" type="button">✕</button>
      </li>`
    )
    .join("");

  list.querySelectorAll(".task-item__delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const li = e.target.closest(".task-item");
      const id = li.dataset.id;
      const ok = await confirmAction("¿Borrar esta tarea?");
      if (!ok) return;
      try {
        await api(`/api/tasks/${id}`, { method: "DELETE" });
        await loadDay();
        await loadStreak();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  });
}

function renderCategoryBreakdown(tasks, totalMinutes) {
  const container = document.getElementById("category-breakdown");
  if (tasks.length === 0 || totalMinutes === 0) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const byCategory = new Map();
  for (const t of tasks) {
    const key = t.category.id;
    if (!byCategory.has(key)) {
      byCategory.set(key, { name: t.category.name, color: t.category.color || "#999", minutes: 0 });
    }
    byCategory.get(key).minutes += t.minutes;
  }

  const rows = [...byCategory.values()].sort((a, b) => b.minutes - a.minutes);

  container.innerHTML = rows
    .map(
      (r) => `
      <div class="breakdown-row">
        <span class="breakdown-row__label">${escapeHtml(r.name)}</span>
        <div class="breakdown-row__track">
          <div class="breakdown-row__fill" style="width:${(r.minutes / totalMinutes) * 100}%; background:${r.color}"></div>
        </div>
        <span class="breakdown-row__value">${r.minutes}m</span>
      </div>`
    )
    .join("");
  container.classList.remove("hidden");
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
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
    document.getElementById("task-name").focus();
    await loadDay();
    await loadStreak();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ---------- Sleep ----------
function renderSleep(sleep) {
  document.getElementById("sleep-time").value = sleep?.sleep_time?.slice(0, 5) || "";
  document.getElementById("wake-time").value = sleep?.wake_time?.slice(0, 5) || "";
  document.getElementById("light-pct").value = sleep?.light_pct ?? "";
  document.getElementById("deep-pct").value = sleep?.deep_pct ?? "";
  document.getElementById("rem-pct").value = sleep?.rem_pct ?? "";

  updateSleepVisuals(sleep);
}

function updateSleepVisuals(sleep) {
  const durationPill = document.getElementById("sleep-duration");
  const bar = document.getElementById("sleep-bar");

  // Duración calculada a partir de hora de dormir/despertar
  if (sleep?.sleep_time && sleep?.wake_time) {
    const minutes = minutesBetween(sleep.sleep_time, sleep.wake_time);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    durationPill.textContent = `${h}h ${m}m`;
    durationPill.classList.remove("hidden");
  } else {
    durationPill.classList.add("hidden");
  }

  // Barra apilada de fases
  const { light_pct, deep_pct, rem_pct } = sleep || {};
  if (light_pct != null || deep_pct != null || rem_pct != null) {
    document.getElementById("sleep-bar-light").style.width = `${light_pct || 0}%`;
    document.getElementById("sleep-bar-deep").style.width = `${deep_pct || 0}%`;
    document.getElementById("sleep-bar-rem").style.width = `${rem_pct || 0}%`;
    bar.classList.remove("hidden");
  } else {
    bar.classList.add("hidden");
  }
}

function minutesBetween(startStr, endStr) {
  // startStr/endStr tipo "HH:MM:SS". Si despertar < dormir, asumimos que cruza medianoche.
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return end - start;
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
    const saved = await api("/api/sleep", { method: "PUT", body: JSON.stringify(payload) });
    updateSleepVisuals(saved);
    showToast("Sueño guardado", "success");
  } catch (err) {
    showToast(err.message, "error");
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
