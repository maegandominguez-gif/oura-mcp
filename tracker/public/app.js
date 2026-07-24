// ---------- tiny API client ----------
async function api(path, options) {
	const res = await fetch(path, {
		...options,
		headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error || `request failed (${res.status})`);
	}
	if (res.status === 204) return null;
	return res.json();
}

// ---------- shared state ----------
const state = {
	date: todayISO(),
	tab: "dashboard",
	exerciseNames: [],
	selectedExercise: null,
};

function todayISO() {
	return new Date().toISOString().split("T")[0];
}

function shiftDate(iso, days) {
	const d = new Date(`${iso}T00:00:00`);
	d.setDate(d.getDate() + days);
	return d.toISOString().split("T")[0];
}

function formatDateLabel(iso) {
	const d = new Date(`${iso}T00:00:00`);
	return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function toast(message) {
	const el = document.getElementById("toast");
	el.textContent = message;
	el.classList.add("show");
	clearTimeout(toast._t);
	toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- tiny canvas line chart ----------
function drawLineChart(canvas, points, opts = {}) {
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	const ctx = canvas.getContext("2d");
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, rect.width, rect.height);

	if (!points.length) {
		ctx.fillStyle = "#9aa1ac";
		ctx.font = "13px sans-serif";
		ctx.fillText("No data yet", 12, rect.height / 2);
		return;
	}

	const padding = { top: 16, right: 16, bottom: 24, left: 40 };
	const w = rect.width - padding.left - padding.right;
	const h = rect.height - padding.top - padding.bottom;

	const ys = points.map((p) => p.y);
	let minY = Math.min(...ys);
	let maxY = Math.max(...ys);
	if (minY === maxY) {
		minY -= 1;
		maxY += 1;
	}
	const yPad = (maxY - minY) * 0.1;
	minY -= yPad;
	maxY += yPad;

	const xFor = (i) => padding.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
	const yFor = (y) => padding.top + h - ((y - minY) / (maxY - minY)) * h;

	// gridlines + y labels
	ctx.strokeStyle = "#2a2f3a";
	ctx.fillStyle = "#9aa1ac";
	ctx.font = "11px sans-serif";
	ctx.lineWidth = 1;
	const steps = 4;
	for (let i = 0; i <= steps; i++) {
		const y = padding.top + (h / steps) * i;
		ctx.beginPath();
		ctx.moveTo(padding.left, y);
		ctx.lineTo(padding.left + w, y);
		ctx.stroke();
		const value = maxY - ((maxY - minY) / steps) * i;
		ctx.fillText(value.toFixed(value < 10 ? 1 : 0), 4, y + 3);
	}

	// line
	ctx.strokeStyle = opts.color || "#6ee7b7";
	ctx.lineWidth = 2;
	ctx.beginPath();
	points.forEach((p, i) => {
		const x = xFor(i);
		const y = yFor(p.y);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	});
	ctx.stroke();

	// dots
	ctx.fillStyle = opts.color || "#6ee7b7";
	points.forEach((p, i) => {
		ctx.beginPath();
		ctx.arc(xFor(i), yFor(p.y), 3, 0, Math.PI * 2);
		ctx.fill();
	});

	// x labels (first, middle, last)
	ctx.fillStyle = "#9aa1ac";
	const labelIdxs = new Set([0, points.length - 1, Math.floor((points.length - 1) / 2)]);
	labelIdxs.forEach((i) => {
		if (i < 0 || i >= points.length) return;
		ctx.fillText(points[i].x, xFor(i) - 14, rect.height - 6);
	});
}

// ---------- tabs ----------
function setTab(tab) {
	state.tab = tab;
	document.querySelectorAll("nav.tabs button").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.tab === tab);
	});
	document.querySelectorAll(".view").forEach((view) => {
		view.classList.toggle("active", view.id === `view-${tab}`);
	});
	refreshActiveTab();
}

function refreshActiveTab() {
	if (state.tab === "dashboard") renderDashboard();
	if (state.tab === "journal") renderJournal();
	if (state.tab === "workouts") renderWorkouts();
	if (state.tab === "macros") renderMacros();
}

// ---------- date nav ----------
function renderDateNav() {
	document.getElementById("date-label").textContent = formatDateLabel(state.date);
	document.getElementById("date-input").value = state.date;
}

function setDate(iso) {
	state.date = iso;
	renderDateNav();
	refreshActiveTab();
}

// ---------- dashboard ----------
async function renderDashboard() {
	const container = document.getElementById("view-dashboard");
	container.innerHTML = `<div class="muted">Loading…</div>`;

	try {
		const data = await api(`/api/dashboard?date=${state.date}`);
		const oura = data.oura || {};

		let ouraCard;
		if (!oura.connected) {
			ouraCard = `
				<div class="card">
					<h2>Oura</h2>
					<div class="empty-state">Not connected. Set <code>OURA_API_KEY</code> in <code>tracker/.env</code> to see ring data here.</div>
				</div>`;
		} else if (oura.error) {
			ouraCard = `<div class="card"><h2>Oura</h2><div class="empty-state">${escapeHtml(oura.error)}</div></div>`;
		} else {
			const readiness = oura.readiness?.score ?? "–";
			const sleep = oura.sleep?.score ?? "–";
			const steps = oura.activity?.steps ?? "–";
			const cals = oura.activity?.total_calories ?? "–";
			ouraCard = `
				<div class="card">
					<h2>Oura</h2>
					<div class="grid">
						<div class="stat"><div class="value">${readiness}</div><div class="label">Readiness</div></div>
						<div class="stat"><div class="value">${sleep}</div><div class="label">Sleep Score</div></div>
						<div class="stat"><div class="value">${steps}</div><div class="label">Steps</div></div>
						<div class="stat"><div class="value">${cals}</div><div class="label">Calories Burned</div></div>
					</div>
				</div>`;
		}

		const journal = data.journal;
		const journalCard = `
			<div class="card">
				<h2>Journal</h2>
				${journal
					? `<div>${journal.mood ? moodEmoji(journal.mood) + " " : ""}${journal.energy ? `<span class="pill">Energy ${journal.energy}/5</span>` : ""}</div>
					   <p style="margin:0.5rem 0 0;">${escapeHtml(journal.notes || "")}</p>`
					: `<div class="empty-state">No entry yet for this day.</div>`}
				<button class="secondary" style="margin-top:0.6rem" onclick="setTab('journal')">Open journal →</button>
			</div>`;

		const workoutsCard = `
			<div class="card">
				<h2>Workouts</h2>
				${data.workouts.length
					? data.workouts.map((w) => `<div class="list-item"><div class="list-item-header"><span class="title">${escapeHtml(w.name)}</span><span class="muted">${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"}</span></div></div>`).join("")
					: `<div class="empty-state">No workout logged for this day.</div>`}
				<button class="secondary" style="margin-top:0.6rem" onclick="setTab('workouts')">Open workouts →</button>
			</div>`;

		const totals = data.macroTotals;
		const macrosCard = `
			<div class="card">
				<h2>Macros</h2>
				<div class="grid">
					<div class="stat"><div class="value">${Math.round(totals.calories)}</div><div class="label">Calories</div></div>
					<div class="stat"><div class="value">${Math.round(totals.protein)}g</div><div class="label">Protein</div></div>
					<div class="stat"><div class="value">${Math.round(totals.carbs)}g</div><div class="label">Carbs</div></div>
					<div class="stat"><div class="value">${Math.round(totals.fat)}g</div><div class="label">Fat</div></div>
				</div>
				<button class="secondary" style="margin-top:0.6rem" onclick="setTab('macros')">Open macros →</button>
			</div>`;

		container.innerHTML = ouraCard + journalCard + workoutsCard + macrosCard;
	} catch (err) {
		container.innerHTML = `<div class="card"><div class="empty-state">Failed to load dashboard: ${escapeHtml(err.message)}</div></div>`;
	}
}

function moodEmoji(mood) {
	return ["😞", "🙁", "😐", "🙂", "😄"][Math.min(Math.max(mood - 1, 0), 4)] || "";
}

function escapeHtml(str) {
	return String(str ?? "").replace(/[&<>"']/g, (c) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#39;",
	}[c]));
}

// ---------- journal ----------
async function renderJournal() {
	const container = document.getElementById("view-journal");
	container.innerHTML = `<div class="muted">Loading…</div>`;

	const [entry, allEntries] = await Promise.all([
		api(`/api/journal/${state.date}`),
		api(`/api/journal`),
	]);

	const mood = entry?.mood ?? 0;
	const energy = entry?.energy ?? 0;

	container.innerHTML = `
		<div class="card">
			<h2>Entry for ${formatDateLabel(state.date)}</h2>
			<label>Mood
				<div class="mood-picker" id="mood-picker">
					${[1, 2, 3, 4, 5].map((m) => `<button type="button" data-mood="${m}" class="${m === mood ? "selected" : ""}">${moodEmoji(m)}</button>`).join("")}
				</div>
			</label>
			<label style="margin-top:0.75rem">Energy (1–5)
				<input type="number" id="energy-input" min="1" max="5" value="${energy || ""}" />
			</label>
			<label style="margin-top:0.75rem">Notes
				<textarea id="notes-input" placeholder="How did today go? Soreness, motivation, sleep, anything worth remembering...">${escapeHtml(entry?.notes || "")}</textarea>
			</label>
			<button class="primary" style="margin-top:0.75rem" id="save-journal">Save entry</button>
		</div>
		<div class="card">
			<h2>Past entries</h2>
			${allEntries.length
				? allEntries.slice(0, 20).map((e) => `
					<div class="list-item">
						<div class="list-item-header">
							<span class="title">${formatDateLabel(e.date)}</span>
							<button class="icon-btn" data-jump="${e.date}">View</button>
						</div>
						<div>${e.mood ? moodEmoji(e.mood) : ""} ${e.energy ? `<span class="pill">Energy ${e.energy}/5</span>` : ""}</div>
						${e.notes ? `<div class="muted">${escapeHtml(e.notes)}</div>` : ""}
					</div>`).join("")
				: `<div class="empty-state">No journal entries yet.</div>`}
		</div>
	`;

	let selectedMood = mood;
	container.querySelectorAll("#mood-picker button").forEach((btn) => {
		btn.addEventListener("click", () => {
			selectedMood = Number(btn.dataset.mood);
			container.querySelectorAll("#mood-picker button").forEach((b) => b.classList.toggle("selected", b === btn));
		});
	});

	container.querySelector("#save-journal").addEventListener("click", async () => {
		try {
			await api(`/api/journal`, {
				method: "PUT",
				body: JSON.stringify({
					date: state.date,
					mood: selectedMood || null,
					energy: Number(container.querySelector("#energy-input").value) || null,
					notes: container.querySelector("#notes-input").value || null,
				}),
			});
			toast("Journal entry saved");
			renderJournal();
		} catch (err) {
			toast(err.message);
		}
	});

	container.querySelectorAll("[data-jump]").forEach((btn) => {
		btn.addEventListener("click", () => setDate(btn.dataset.jump));
	});
}

// ---------- workouts ----------
let workoutDraft = null;

function newWorkoutDraft() {
	return { date: state.date, name: "", notes: "", exercises: [{ name: "", sets: [{ reps: "", weight: "", unit: "lb", rpe: "" }] }] };
}

async function renderWorkouts() {
	if (!workoutDraft) workoutDraft = newWorkoutDraft();
	const container = document.getElementById("view-workouts");
	container.innerHTML = `<div class="muted">Loading…</div>`;

	const [workouts, exerciseNames] = await Promise.all([
		api(`/api/workouts`),
		api(`/api/exercises`),
	]);
	state.exerciseNames = exerciseNames;

	container.innerHTML = `
		<div class="card">
			<h2>Log a workout</h2>
			<div class="form-row">
				<label>Date <input type="text" id="workout-date" value="${workoutDraft.date}" /></label>
				<label>Name <input type="text" id="workout-name" placeholder="Push Day" value="${escapeHtml(workoutDraft.name)}" /></label>
			</div>
			<div id="exercise-list" style="display:flex;flex-direction:column;gap:0.6rem;margin-top:0.75rem;"></div>
			<button class="secondary" id="add-exercise" style="margin-top:0.5rem;">+ Add exercise</button>
			<label style="margin-top:0.75rem">Notes <textarea id="workout-notes">${escapeHtml(workoutDraft.notes)}</textarea></label>
			<button class="primary" id="save-workout" style="margin-top:0.75rem;">Save workout</button>
		</div>

		<div class="card">
			<h2>Exercise trend</h2>
			<div class="exercise-select-row">
				<select id="exercise-select" style="max-width:220px;">
					<option value="">Select an exercise…</option>
					${state.exerciseNames.map((n) => `<option value="${escapeHtml(n)}" ${n === state.selectedExercise ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")}
				</select>
			</div>
			<canvas class="chart" id="exercise-chart" style="margin-top:0.75rem;"></canvas>
		</div>

		<div class="card">
			<h2>History</h2>
			${workouts.length
				? workouts.map(renderWorkoutListItem).join("")
				: `<div class="empty-state">No workouts logged yet.</div>`}
		</div>
	`;

	renderExerciseBlocks();

	container.querySelector("#workout-date").addEventListener("input", (e) => (workoutDraft.date = e.target.value));
	container.querySelector("#workout-name").addEventListener("input", (e) => (workoutDraft.name = e.target.value));
	container.querySelector("#workout-notes").addEventListener("input", (e) => (workoutDraft.notes = e.target.value));

	container.querySelector("#add-exercise").addEventListener("click", () => {
		workoutDraft.exercises.push({ name: "", sets: [{ reps: "", weight: "", unit: "lb", rpe: "" }] });
		renderExerciseBlocks();
	});

	container.querySelector("#save-workout").addEventListener("click", async () => {
		if (!workoutDraft.name.trim()) {
			toast("Give the workout a name");
			return;
		}
		try {
			await api(`/api/workouts`, {
				method: "POST",
				body: JSON.stringify({
					date: workoutDraft.date,
					name: workoutDraft.name,
					notes: workoutDraft.notes || null,
					exercises: workoutDraft.exercises
						.filter((e) => e.name.trim())
						.map((e) => ({
							name: e.name,
							sets: e.sets
								.filter((s) => s.reps !== "" || s.weight !== "")
								.map((s) => ({
									reps: s.reps === "" ? null : Number(s.reps),
									weight: s.weight === "" ? null : Number(s.weight),
									unit: s.unit,
									rpe: s.rpe === "" ? null : Number(s.rpe),
								})),
						})),
				}),
			});
			toast("Workout saved");
			workoutDraft = newWorkoutDraft();
			renderWorkouts();
		} catch (err) {
			toast(err.message);
		}
	});

	container.querySelectorAll("[data-delete-workout]").forEach((btn) => {
		btn.addEventListener("click", async () => {
			if (!confirm("Delete this workout?")) return;
			await api(`/api/workouts/${btn.dataset.deleteWorkout}`, { method: "DELETE" });
			toast("Workout deleted");
			renderWorkouts();
		});
	});

	const exerciseSelect = container.querySelector("#exercise-select");
	if (state.selectedExercise) exerciseSelect.value = state.selectedExercise;
	exerciseSelect.addEventListener("change", async () => {
		state.selectedExercise = exerciseSelect.value || null;
		await renderExerciseChart();
	});
	await renderExerciseChart();
}

function renderWorkoutListItem(w) {
	return `
		<div class="list-item">
			<div class="list-item-header">
				<span class="title">${escapeHtml(w.name)}</span>
				<span>
					<span class="muted">${formatDateLabel(w.date)}</span>
					<button class="icon-btn" data-delete-workout="${w.id}">Delete</button>
				</span>
			</div>
			${w.exercises.map((e) => `
				<div class="muted">
					<strong>${escapeHtml(e.name)}</strong>:
					${e.sets.map((s) => `${s.reps ?? "?"}×${s.weight ?? "?"}${s.unit}`).join(", ") || "no sets logged"}
				</div>
			`).join("")}
			${w.notes ? `<div class="muted">${escapeHtml(w.notes)}</div>` : ""}
		</div>`;
}

function renderExerciseBlocks() {
	const list = document.getElementById("exercise-list");
	list.innerHTML = workoutDraft.exercises.map((exercise, ei) => `
		<div class="exercise-block" data-ei="${ei}">
			<div class="exercise-select-row">
				<input type="text" list="known-exercises" placeholder="Exercise name" value="${escapeHtml(exercise.name)}" data-exercise-name="${ei}" style="flex:1;min-width:160px;" />
				<button class="icon-btn" data-remove-exercise="${ei}">Remove</button>
			</div>
			${exercise.sets.map((set, si) => `
				<div class="set-row" data-si="${si}">
					<span class="muted">#${si + 1}</span>
					<input type="number" placeholder="reps" value="${set.reps}" data-set-field="reps" data-ei="${ei}" data-si="${si}" />
					<input type="number" placeholder="weight" value="${set.weight}" data-set-field="weight" data-ei="${ei}" data-si="${si}" />
					<select data-set-field="unit" data-ei="${ei}" data-si="${si}">
						<option value="lb" ${set.unit === "lb" ? "selected" : ""}>lb</option>
						<option value="kg" ${set.unit === "kg" ? "selected" : ""}>kg</option>
					</select>
					<button class="icon-btn" data-remove-set="${ei}:${si}">✕</button>
				</div>
			`).join("")}
			<button class="secondary" data-add-set="${ei}" style="align-self:flex-start;">+ Add set</button>
		</div>
	`).join("") + `<datalist id="known-exercises">${state.exerciseNames.map((n) => `<option value="${escapeHtml(n)}">`).join("")}</datalist>`;

	list.querySelectorAll("[data-exercise-name]").forEach((input) => {
		input.addEventListener("input", (e) => {
			workoutDraft.exercises[Number(input.dataset.exerciseName)].name = e.target.value;
		});
	});
	list.querySelectorAll("[data-set-field]").forEach((input) => {
		input.addEventListener("input", (e) => {
			const ei = Number(input.dataset.ei);
			const si = Number(input.dataset.si);
			workoutDraft.exercises[ei].sets[si][input.dataset.setField] = e.target.value;
		});
	});
	list.querySelectorAll("[data-add-set]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const ei = Number(btn.dataset.addSet);
			workoutDraft.exercises[ei].sets.push({ reps: "", weight: "", unit: "lb", rpe: "" });
			renderExerciseBlocks();
		});
	});
	list.querySelectorAll("[data-remove-set]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const [ei, si] = btn.dataset.removeSet.split(":").map(Number);
			workoutDraft.exercises[ei].sets.splice(si, 1);
			renderExerciseBlocks();
		});
	});
	list.querySelectorAll("[data-remove-exercise]").forEach((btn) => {
		btn.addEventListener("click", () => {
			workoutDraft.exercises.splice(Number(btn.dataset.removeExercise), 1);
			if (!workoutDraft.exercises.length) workoutDraft.exercises.push({ name: "", sets: [{ reps: "", weight: "", unit: "lb", rpe: "" }] });
			renderExerciseBlocks();
		});
	});
}

async function renderExerciseChart() {
	const canvas = document.getElementById("exercise-chart");
	if (!state.selectedExercise) {
		drawLineChart(canvas, []);
		return;
	}
	const history = await api(`/api/exercises/${encodeURIComponent(state.selectedExercise)}/history`);
	const maxByDate = new Map();
	for (const row of history) {
		if (row.weight == null) continue;
		const current = maxByDate.get(row.date) ?? 0;
		maxByDate.set(row.date, Math.max(current, row.weight));
	}
	const points = [...maxByDate.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([date, weight]) => ({ x: formatDateLabel(date), y: weight }));
	drawLineChart(canvas, points, { color: "#6ee7b7" });
}

// ---------- macros ----------
async function renderMacros() {
	const container = document.getElementById("view-macros");
	container.innerHTML = `<div class="muted">Loading…</div>`;

	const to = state.date;
	const from = shiftDate(to, -29);

	const [entries, summary] = await Promise.all([
		api(`/api/macros?from=${from}&to=${to}`),
		api(`/api/macros/summary?from=${from}&to=${to}`),
	]);

	const todays = entries.filter((e) => e.date === state.date);

	container.innerHTML = `
		<div class="card">
			<h2>Log food for ${formatDateLabel(state.date)}</h2>
			<div class="form-row">
				<label>Label <input type="text" id="macro-label" placeholder="Lunch" /></label>
				<label>Calories <input type="number" id="macro-calories" /></label>
				<label>Protein (g) <input type="number" id="macro-protein" /></label>
				<label>Carbs (g) <input type="number" id="macro-carbs" /></label>
				<label>Fat (g) <input type="number" id="macro-fat" /></label>
			</div>
			<label style="margin-top:0.6rem">Notes <input type="text" id="macro-notes" /></label>
			<button class="primary" id="save-macro" style="margin-top:0.75rem;">Add entry</button>
		</div>

		<div class="card">
			<h2>Today's entries</h2>
			${todays.length
				? todays.map((m) => `
					<div class="list-item">
						<div class="list-item-header">
							<span class="title">${escapeHtml(m.label || "Entry")}</span>
							<button class="icon-btn" data-delete-macro="${m.id}">Delete</button>
						</div>
						<div class="muted">${m.calories ?? 0} cal · P${m.protein ?? 0}g · C${m.carbs ?? 0}g · F${m.fat ?? 0}g</div>
						${m.notes ? `<div class="muted">${escapeHtml(m.notes)}</div>` : ""}
					</div>`).join("")
				: `<div class="empty-state">Nothing logged for this day yet.</div>`}
		</div>

		<div class="card">
			<h2>Calories — last 30 days</h2>
			<canvas class="chart" id="macro-chart"></canvas>
		</div>
	`;

	drawLineChart(
		document.getElementById("macro-chart"),
		summary.map((s) => ({ x: formatDateLabel(s.date), y: s.calories })),
		{ color: "#fbbf24" },
	);

	container.querySelector("#save-macro").addEventListener("click", async () => {
		try {
			await api(`/api/macros`, {
				method: "POST",
				body: JSON.stringify({
					date: state.date,
					label: container.querySelector("#macro-label").value || null,
					calories: Number(container.querySelector("#macro-calories").value) || null,
					protein: Number(container.querySelector("#macro-protein").value) || null,
					carbs: Number(container.querySelector("#macro-carbs").value) || null,
					fat: Number(container.querySelector("#macro-fat").value) || null,
					notes: container.querySelector("#macro-notes").value || null,
				}),
			});
			toast("Logged");
			renderMacros();
		} catch (err) {
			toast(err.message);
		}
	});

	container.querySelectorAll("[data-delete-macro]").forEach((btn) => {
		btn.addEventListener("click", async () => {
			await api(`/api/macros/${btn.dataset.deleteMacro}`, { method: "DELETE" });
			renderMacros();
		});
	});
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
	renderDateNav();

	document.querySelectorAll("nav.tabs button").forEach((btn) => {
		btn.addEventListener("click", () => setTab(btn.dataset.tab));
	});

	document.getElementById("prev-day").addEventListener("click", () => setDate(shiftDate(state.date, -1)));
	document.getElementById("next-day").addEventListener("click", () => setDate(shiftDate(state.date, 1)));
	document.getElementById("today-btn").addEventListener("click", () => setDate(todayISO()));
	document.getElementById("date-input").addEventListener("change", (e) => setDate(e.target.value));

	setTab("dashboard");
});
