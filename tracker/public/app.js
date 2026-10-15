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
	programData: null,
	programDay: "A",
};

// Dates are the user's local calendar day. toISOString() would give the UTC day,
// which rolls over to tomorrow in the evening in US time zones.
function localISO(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO() {
	return localISO(new Date());
}

function shiftDate(iso, days) {
	const d = new Date(`${iso}T00:00:00`);
	d.setDate(d.getDate() + days);
	return localISO(d);
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
	let minY = opts.minY ?? Math.min(...ys);
	let maxY = Math.max(...ys, opts.goal ?? -Infinity);
	if (minY === maxY) {
		minY -= 1;
		maxY += 1;
	}
	const yPad = (maxY - minY) * 0.1;
	if (opts.minY == null) minY -= yPad;
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
		ctx.fillText(value.toFixed(value !== 0 && Math.abs(value) < 10 ? 1 : 0), 4, y + 3);
	}

	// goal line
	if (opts.goal != null) {
		ctx.save();
		ctx.setLineDash([5, 4]);
		ctx.strokeStyle = "#9aa1ac";
		ctx.beginPath();
		ctx.moveTo(padding.left, yFor(opts.goal));
		ctx.lineTo(padding.left + w, yFor(opts.goal));
		ctx.stroke();
		ctx.fillStyle = "#9aa1ac";
		ctx.textAlign = "right";
		ctx.fillText(`goal ${opts.goal}`, padding.left + w, yFor(opts.goal) - 4);
		ctx.restore();
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
		// anchor the first and last labels to the plot edges so they aren't clipped
		ctx.textAlign = i === 0 ? "left" : i === points.length - 1 ? "right" : "center";
		ctx.fillText(points[i].x, i === points.length - 1 ? Math.min(xFor(i) + 4, rect.width - 2) : xFor(i) - (i === 0 ? 4 : 0), rect.height - 6);
	});
}

// ---------- tabs ----------
function setTab(tab) {
	state.tab = tab;
	document.querySelectorAll("nav.tabs button").forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.tab === tab);
		if (btn.dataset.tab === tab) scrollTabIntoView(btn);
	});
	document.querySelectorAll(".view").forEach((view) => {
		view.classList.toggle("active", view.id === `view-${tab}`);
	});
	refreshActiveTab();
}

// Scrolls only the tab bar (not the page) so a partly hidden active tab is fully visible.
function scrollTabIntoView(btn) {
	const bar = btn.parentElement;
	const left = btn.offsetLeft - bar.offsetLeft;
	const right = left + btn.offsetWidth;
	const edge = 32; // clear the right-edge fade
	if (left < bar.scrollLeft) bar.scrollTo({ left: left - edge, behavior: "smooth" });
	else if (right > bar.scrollLeft + bar.clientWidth - edge) bar.scrollTo({ left: right - bar.clientWidth + edge, behavior: "smooth" });
}

function refreshActiveTab() {
	if (state.tab === "dashboard") renderDashboard();
	if (state.tab === "program") renderProgram();
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
function formatDuration(seconds) {
	if (seconds == null) return null;
	const h = Math.floor(seconds / 3600);
	const m = Math.round((seconds % 3600) / 60);
	return h ? `${h}h ${m}m` : `${m}m`;
}

function ouraStat(value, label) {
	return `<div class="stat"><div class="value">${value ?? "–"}</div><div class="label">${label}</div></div>`;
}

// "strengthTraining" -> "Strength training"
function humanizeActivity(activity) {
	if (activity === "hiit") return "HIIT";
	const words = activity.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
	return words[0].toUpperCase() + words.slice(1);
}

// "45 min · 226 cal · 1.6 mi · moderate" for a workout imported from Oura
function ouraDetailsText(info) {
	return [
		`${info.minutes} min`,
		info.calories != null ? `${Math.round(info.calories)} cal` : null,
		info.distance >= 400 ? `${(info.distance / 1609.34).toFixed(1)} mi` : null, // skip incidental distance on classes
		info.intensity,
		info.autodetected ? "auto-detected" : null,
	].filter(Boolean).join(" · ");
}

// Imports new Oura workouts into the log, then re-renders if any arrived.
// Rate-limited here as well as on the server, so a re-render can't loop.
let ouraSyncStartedAt = 0;
async function syncOuraWorkouts(rerender) {
	if (Date.now() - ouraSyncStartedAt < 60_000) return;
	ouraSyncStartedAt = Date.now();
	try {
		const result = await api("/api/oura/sync", { method: "POST" });
		if (result.added) {
			toast(`Synced ${result.added} workout${result.added === 1 ? "" : "s"} from Oura`);
			rerender();
		}
	} catch {
		// Oura unavailable; try again on a later page load
	}
}

function renderOuraCard(oura) {
	const { readiness, sleep, activity, stress, spo2, sleepPeriod: night } = oura;
	const num = (n) => (n == null ? null : Math.round(n).toLocaleString());
	// Oura reports temperature deviation in °C; show it in °F with a sign
	const temp = readiness?.temperature_deviation;
	const tempF = temp == null ? null : `${temp >= 0 ? "+" : "−"}${Math.abs(temp * 1.8).toFixed(1)}°F`;
	const miles = activity?.equivalent_walking_distance == null ? null : (activity.equivalent_walking_distance / 1609.34).toFixed(1);
	const stressSummary = stress?.day_summary ? stress.day_summary[0].toUpperCase() + stress.day_summary.slice(1) : null;

	const group = (title, stats) => `
		<div class="oura-group">
			<div class="oura-group-title">${title}</div>
			<div class="grid">${stats.join("")}</div>
		</div>`;

	return `
		<div class="card">
			<h2>Oura</h2>
			${group("Recovery", [
				ouraStat(readiness?.score, "Readiness"),
				ouraStat(num(night?.average_hrv), "HRV (ms)"),
				ouraStat(num(night?.lowest_heart_rate), "Resting HR"),
				ouraStat(tempF, "Temp vs baseline"),
			])}
			${group("Sleep", [
				ouraStat(sleep?.score, "Sleep score"),
				ouraStat(formatDuration(night?.total_sleep_duration), "Total sleep"),
				ouraStat(night?.efficiency != null ? `${night.efficiency}%` : null, "Efficiency"),
				ouraStat(formatDuration(night?.deep_sleep_duration), "Deep"),
				ouraStat(formatDuration(night?.rem_sleep_duration), "REM"),
			])}
			${group("Activity", [
				ouraStat(num(activity?.steps), "Steps"),
				ouraStat(num(activity?.active_calories), "Active cal"),
				ouraStat(num(activity?.total_calories), "Total cal"),
				ouraStat(miles, "Walking (mi)"),
			])}
			${group("Stress & SpO₂", [
				ouraStat(stressSummary, "Day summary"),
				ouraStat(formatDuration(stress?.stress_high), "High stress"),
				ouraStat(formatDuration(stress?.recovery_high), "Recovery"),
				ouraStat(spo2?.spo2_percentage?.average != null ? `${spo2.spo2_percentage.average.toFixed(1)}%` : null, "SpO₂"),
			])}
		</div>`;
}

async function renderDashboard() {
	const container = document.getElementById("view-dashboard");
	container.innerHTML = `<div class="muted">Loading…</div>`;
	syncOuraWorkouts(() => state.tab === "dashboard" && renderDashboard());

	try {
		const data = await api(`/api/dashboard?date=${state.date}`);
		const oura = data.oura || {};

		let ouraCard;
		if (!oura.connected) {
			ouraCard = `
				<div class="card">
					<h2>Oura</h2>
					<div class="empty-state">Not connected. <a href="/auth/oura/login">Connect Oura</a> to see ring data here.</div>
				</div>`;
		} else if (oura.error) {
			ouraCard = `<div class="card"><h2>Oura</h2><div class="empty-state">${escapeHtml(oura.error)}</div></div>`;
		} else {
			ouraCard = renderOuraCard(oura);
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
					? data.workouts.map((w) => `<div class="list-item"><div class="list-item-header"><span class="title">${escapeHtml(w.name)}${w.oura ? ` <span class="pill">Oura</span>` : ""}</span><span class="muted">${w.oura ? escapeHtml(ouraDetailsText(w.oura)) : `${w.exercises.length} exercise${w.exercises.length === 1 ? "" : "s"}`}</span></div></div>`).join("")
					: `<div class="empty-state">No workout logged for this day.</div>`}
				<button class="secondary" style="margin-top:0.6rem" onclick="setTab('workouts')">Open workouts →</button>
			</div>`;

		const macrosCard = `
			<div class="card">
				<h2>Protein</h2>
				${renderProteinProgressHtml(data.macroTotals.protein)}
				<button class="secondary" style="margin-top:0.6rem" onclick="setTab('macros')">Log protein →</button>
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
	syncOuraWorkouts(() => state.tab === "workouts" && renderWorkouts());

	const [workouts, exerciseNames] = await Promise.all([
		api(`/api/workouts`),
		api(`/api/exercises`),
	]);
	state.exerciseNames = exerciseNames;

	container.innerHTML = `
		<div class="card">
			<h2>Log a workout</h2>
			<div class="program-start">
				<span class="muted">Start from program</span>
				<div class="program-start-buttons">
					${["A", "B", "C"].map((id) => `<button class="secondary" data-start-day="${id}">Day ${id}</button>`).join("")}
				</div>
			</div>
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
			<h2>Cardio from Oura</h2>
			<div class="muted" id="cardio-summary">Loading…</div>
			<canvas class="chart" id="cardio-chart" style="margin-top:0.75rem;"></canvas>
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

	container.querySelectorAll("[data-start-day]").forEach((btn) => {
		btn.addEventListener("click", async () => {
			const hasEntries = workoutDraft.exercises.some((e) => e.name.trim() || e.sets.some((s) => s.weight !== "" || s.rpe !== ""));
			if (hasEntries && !confirm("Replace what you've entered with this program day?")) return;
			const program = await loadProgram();
			const day = program.days.find((d) => d.id === btn.dataset.startDay);
			workoutDraft = buildDraftFromProgramDay(day, await loadProgression(day));
			renderWorkouts();
			toast(`Day ${day.id} loaded with today's targets. Log RPE on every set.`);
		});
	});

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
					readiness: workoutDraft.readiness ?? null,
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
	await Promise.all([renderExerciseChart(), renderCardio()]);
}

const CARDIO_WEEKS = 8;

function workoutMinutes(w) {
	return Math.round((new Date(w.end_datetime) - new Date(w.start_datetime)) / 60000);
}

// Monday of the week containing `iso`
function weekStart(iso) {
	const dow = (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;
	return shiftDate(iso, -dow);
}

// Weekly cardio minutes from Oura-recorded workouts, plus the recent sessions.
async function renderCardio() {
	const summary = document.getElementById("cardio-summary");
	const canvas = document.getElementById("cardio-chart");

	const thisWeek = weekStart(state.date);
	const from = shiftDate(thisWeek, -7 * (CARDIO_WEEKS - 1));
	let data;
	try {
		data = await api(`/api/oura/workouts?from=${from}&to=${state.date}`);
	} catch (err) {
		summary.textContent = `Couldn't load Oura workouts: ${err.message}`;
		canvas.style.display = "none";
		return;
	}
	if (!data.connected) {
		summary.innerHTML = `<a href="/auth/oura/login">Connect Oura</a> to see cardio here.`;
		canvas.style.display = "none";
		return;
	}

	const weeks = Array.from({ length: CARDIO_WEEKS }, (_, i) => shiftDate(from, 7 * i));
	const minutesByWeek = new Map(weeks.map((w) => [w, 0]));
	for (const w of data.workouts) {
		const week = weekStart(w.day);
		if (minutesByWeek.has(week)) minutesByWeek.set(week, minutesByWeek.get(week) + workoutMinutes(w));
	}
	const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
	drawLineChart(canvas, weeks.map((w) => ({ x: shortDate(w), y: minutesByWeek.get(w) })), { color: "#7eb8f0", minY: 0 });

	const current = data.workouts.filter((w) => w.day >= thisWeek);
	summary.textContent = `This week: ${minutesByWeek.get(thisWeek)} min across ${current.length} session${current.length === 1 ? "" : "s"} · weekly minutes, last ${CARDIO_WEEKS} weeks`;
}

function renderWorkoutListItem(w) {
	return `
		<div class="list-item">
			<div class="list-item-header">
				<span class="title">${escapeHtml(w.name)}${w.oura ? ` <span class="pill">Oura</span>` : ""}</span>
				<span>
					<span class="muted">${formatDateLabel(w.date)}${w.readiness != null ? ` · Readiness ${w.readiness}` : ""}</span>
					<button class="icon-btn" data-delete-workout="${w.id}">Delete</button>
				</span>
			</div>
			${w.exercises.map((e) => `
				<div class="muted">
					<strong>${escapeHtml(e.name)}</strong>:
					${e.sets.map((s) => `${s.reps ?? "?"}×${s.weight ?? "?"}${s.unit}${s.rpe != null ? ` @${s.rpe}` : ""}`).join(", ") || "no sets logged"}
				</div>
			`).join("")}
			${w.oura ? `<div class="muted">${escapeHtml(ouraDetailsText(w.oura))}</div>` : ""}
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
					<input type="number" placeholder="RPE" min="1" max="10" step="0.5" value="${set.rpe}" data-set-field="rpe" data-ei="${ei}" data-si="${si}" />
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

// ---------- protein ----------
// Daily protein floor. The tab still uses the macros API; only protein is logged now.
const PROTEIN_GOAL = 140;

function renderProteinProgressHtml(grams) {
	const total = Math.round(grams ?? 0);
	const met = total >= PROTEIN_GOAL;
	const pct = Math.min(100, (total / PROTEIN_GOAL) * 100);
	return `
		<div class="protein-progress ${met ? "met" : ""}">
			<div class="protein-progress-numbers">
				<span><strong>${total}g</strong> / ${PROTEIN_GOAL}g</span>
				<span class="muted">${met ? "Goal met ✓" : `${PROTEIN_GOAL - total}g to go`}</span>
			</div>
			<div class="protein-bar"><div style="width:${pct}%"></div></div>
		</div>`;
}

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
	const todayTotal = todays.reduce((sum, e) => sum + (e.protein ?? 0), 0);
	const loggedDays = summary.filter((s) => s.protein > 0);
	const daysMet = loggedDays.filter((s) => s.protein >= PROTEIN_GOAL).length;

	container.innerHTML = `
		<div class="card">
			<h2>Protein for ${formatDateLabel(state.date)}</h2>
			${renderProteinProgressHtml(todayTotal)}
			<div class="form-row" style="margin-top:0.9rem;">
				<label>Food <input type="text" id="macro-label" placeholder="Chicken + rice" /></label>
				<label>Protein (g) <input type="number" id="macro-protein" inputmode="decimal" /></label>
			</div>
			<label style="margin-top:0.6rem">Notes <input type="text" id="macro-notes" /></label>
			<button class="primary" id="save-macro" style="margin-top:0.75rem;">Add protein</button>
		</div>

		<div class="card">
			<h2>Entries</h2>
			${todays.length
				? todays.map((m) => `
					<div class="list-item">
						<div class="list-item-header">
							<span class="title">${escapeHtml(m.label || "Entry")}</span>
							<span>
								<strong>${Math.round(m.protein ?? 0)}g</strong>
								<button class="icon-btn" data-delete-macro="${m.id}">Delete</button>
							</span>
						</div>
						${m.notes ? `<div class="muted">${escapeHtml(m.notes)}</div>` : ""}
					</div>`).join("")
				: `<div class="empty-state">Nothing logged for this day yet.</div>`}
		</div>

		<div class="card">
			<h2>Protein — last 30 days</h2>
			<div class="muted">${loggedDays.length
				? `Hit ${PROTEIN_GOAL}g on ${daysMet} of ${loggedDays.length} logged day${loggedDays.length === 1 ? "" : "s"}`
				: "No protein logged in the last 30 days."}</div>
			<canvas class="chart" id="macro-chart" style="margin-top:0.75rem;"></canvas>
		</div>
	`;

	drawLineChart(
		document.getElementById("macro-chart"),
		loggedDays.map((s) => ({ x: formatDateLabel(s.date), y: s.protein })),
		{ color: "#6ee7b7", minY: 0, goal: PROTEIN_GOAL },
	);

	container.querySelector("#save-macro").addEventListener("click", async () => {
		const protein = Number(container.querySelector("#macro-protein").value);
		if (!protein) {
			toast("Enter grams of protein");
			return;
		}
		try {
			await api(`/api/macros`, {
				method: "POST",
				body: JSON.stringify({
					date: state.date,
					label: container.querySelector("#macro-label").value || null,
					protein,
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

// ---------- program ----------
async function loadProgram() {
	if (!state.programData) {
		state.programData = await api("/program.json");
	}
	return state.programData;
}

// The last session's top weight and today's target for each exercise on a day,
// plus that date's readiness. See progression() in routes/workouts.ts.
async function loadProgression(day) {
	const params = new URLSearchParams({ date: state.date });
	day.blocks.forEach((block) => block.exercises.forEach((ex) => params.append("name", ex.name)));
	try {
		return await api(`/api/progression?${params}`);
	} catch {
		return { readiness: null, targets: {} };
	}
}

function buildDraftFromProgramDay(day, prog) {
	const exercises = [];

	day.blocks.forEach((block) => {
		block.exercises.forEach((ex) => {
			const target = prog.targets[ex.name];
			exercises.push({
				name: ex.name,
				sets: Array.from({ length: ex.sets || 1 }, () => ({
					reps: ex.reps != null ? String(ex.reps) : "",
					weight: target?.target != null ? String(target.target) : "",
					unit: target?.last ? target.unit : /kg/i.test(ex.load || "") ? "kg" : "lb",
					rpe: "",
				})),
			});
		});
	});

	if (day.finisher) {
		day.finisher.moves.forEach((move) => {
			exercises.push({
				name: move.name,
				sets: Array.from({ length: move.sets || 1 }, () => ({
					reps: move.reps != null ? String(move.reps) : "",
					weight: "",
					unit: "lb",
					rpe: "",
				})),
			});
		});
	}

	return {
		date: state.date,
		name: `Day ${day.id} — ${day.title}`,
		notes: day.intent,
		readiness: prog.readiness,
		exercises: exercises.length
			? exercises
			: [{ name: "", sets: [{ reps: "", weight: "", unit: "lb", rpe: "" }] }],
	};
}

function renderTempoHtml(tempo) {
	return `
		<div class="card">
			<div class="program-tempo">
				<span class="program-tempo-label muted">${escapeHtml(tempo.label)}</span>
				${tempo.items.map((i) => `<span>${escapeHtml(i)}</span>`).join("")}
			</div>
		</div>`;
}

function renderProgressionHtml(target) {
	if (!target) return "";
	if (!target.last) return `<div class="program-ex-progress">No weighted sets logged yet</div>`;
	const { last, unit } = target;
	const rpe = last.maxRpe != null ? ` @ RPE ${last.maxRpe}` : "";
	return `
		<div class="program-ex-progress">
			Last: ${last.weight} ${unit}${rpe} (${formatDateLabel(last.date)}) → Today: <strong>${target.target} ${unit}</strong>
			· ${escapeHtml(target.reason)}
		</div>`;
}

function renderProgramExerciseHtml(ex, targets) {
	return `
		<div class="program-ex">
			<div class="program-ex-header">
				<div class="program-ex-name">${escapeHtml(ex.name)}</div>
				<div class="program-ex-stats">
					<strong>${escapeHtml(ex.repsLabel || `${ex.sets}×${ex.reps}`)}</strong>
					${ex.load ? escapeHtml(ex.load) : ""}<br/>
					${ex.rest ? escapeHtml(ex.rest) : ""}
				</div>
			</div>
			${ex.cue ? `<div class="program-ex-cue">${ex.cue}</div>` : ""}
			${ex.note ? `<div class="program-ex-note">${escapeHtml(ex.note)}</div>` : ""}
			${/bodyweight/i.test(ex.load || "") ? "" : renderProgressionHtml(targets[ex.name])}
		</div>`;
}

function renderProgramBlockHtml(block, targets) {
	const exercisesHtml = block.exercises.map((ex) => renderProgramExerciseHtml(ex, targets)).join("");

	if (block.supersetHeader) {
		return `
			<div class="card">
				<div class="program-section-label">${escapeHtml(block.label)}</div>
				${block.tempo ? renderTempoHtml(block.tempo) : ""}
				<div class="program-superset">
					<div class="program-superset-header">${escapeHtml(block.supersetHeader)}</div>
					${exercisesHtml}
				</div>
			</div>`;
	}

	return `
		<div class="card">
			<div class="program-section-label">${escapeHtml(block.label)}</div>
			<div style="display:flex;flex-direction:column;gap:0.5rem;">${exercisesHtml}</div>
		</div>`;
}

function renderProgramDayHtml(day, prog) {
	let banner = "";
	const score = prog.readiness;
	if (typeof score === "number") {
		const tier = score >= 85 ? "green" : score >= 70 ? "yellow" : "red";
		const label = tier === "green"
			? "Full Send — execute as written, add load if RPE was 7 or below last time."
			: tier === "yellow"
			? "Modified — primary compounds only, skip supersets and the finisher."
			: "Recovery Day — no lifting. Easy walk + restorative yoga instead.";
		banner = `<div class="program-readiness-banner ${tier}">Readiness ${score} for ${formatDateLabel(state.date)} → <strong>${label}</strong></div>`;
	}

	const warmup = `
		<div class="card">
			<div class="program-section-label">${escapeHtml(day.warmup.label)}</div>
			<div class="program-warmup-grid">
				${day.warmup.items.map((w) => `
					<div class="program-warmup-card">
						<div class="program-badge">${escapeHtml(w.badge)}</div>
						<div style="font-weight:600;font-size:0.85rem;margin-bottom:0.2rem;">${escapeHtml(w.name)}</div>
						<div class="muted" style="font-size:0.78rem;">${escapeHtml(w.detail)}</div>
					</div>
				`).join("")}
			</div>
		</div>`;

	const tempoBlock = day.tempo ? renderTempoHtml(day.tempo) : "";
	const blocks = day.blocks.map((block) => renderProgramBlockHtml(block, prog.targets)).join("");

	const finisher = day.finisher
		? `
		<div class="card">
			<div class="program-section-label">${escapeHtml(day.finisher.label)}</div>
			<div class="program-finisher-moves">
				${day.finisher.moves.map((m) => `
					<div class="program-finisher-move">
						<strong>${escapeHtml(m.name)}</strong>
						<span>${escapeHtml(m.detail)}</span>
					</div>`).join("")}
			</div>
		</div>`
		: "";

	return `
		<div class="card day-${day.id}">
			<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;">
				<div style="display:flex;gap:1rem;align-items:baseline;">
					<div class="program-day-letter">${escapeHtml(day.id)}</div>
					<div>
						<div style="font-size:1.15rem;font-weight:700;">${escapeHtml(day.title)}</div>
						<div class="muted" style="font-size:0.78rem;margin-top:0.2rem;">${escapeHtml(day.duration)} · ${escapeHtml(day.focus)} · ${escapeHtml(day.metaLabel)}: ${escapeHtml(day.metaValue)}</div>
					</div>
				</div>
				<button class="primary" id="start-program-day">Start this workout →</button>
			</div>
			${banner ? `<div style="margin-top:0.75rem;">${banner}</div>` : ""}
			<div class="program-intent" style="margin-top:0.9rem;">${escapeHtml(day.intent)}</div>
		</div>
		${warmup}
		${tempoBlock}
		${blocks}
		${finisher}
		<div class="card">
			<div class="program-section-label">Post-Session Recovery</div>
			<div style="font-weight:600;margin-bottom:0.3rem;">${escapeHtml(day.recovery.title)}</div>
			<div class="muted" style="font-size:0.85rem;line-height:1.6;">${escapeHtml(day.recovery.text)}</div>
		</div>
	`;
}

function renderProgramReferenceHtml(ref) {
	const ouraGrid = `
		<div class="card">
			<div class="program-section-label">Oura Readiness Protocol · All Three Days</div>
			<div class="program-oura-grid">
				${ref.ouraProtocol.map((o) => `
					<div class="program-oura-cell">
						<div class="program-oura-score ${o.tier}">${escapeHtml(o.score)}</div>
						<div class="muted" style="font-size:0.7rem;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:0.4rem;">${escapeHtml(o.title)}</div>
						<div class="program-oura-text">${escapeHtml(o.text)}</div>
					</div>`).join("")}
			</div>
		</div>`;

	const rules = `
		<div class="card">
			<div class="program-section-label">Flexible Scheduling Rules</div>
			<ul style="margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:0.4rem;">
				${ref.schedulingRules.map((r) => `<li class="muted" style="font-size:0.85rem;">${escapeHtml(r)}</li>`).join("")}
			</ul>
		</div>`;

	const progression = `
		<div class="card">
			<div class="program-section-label">12-Week Progression</div>
			<div style="display:flex;flex-direction:column;gap:0.6rem;">
				${ref.progression.map((p) => `
					<div class="program-phase">
						<div class="program-phase-weeks">${escapeHtml(p.weeks)}</div>
						<div>
							<div class="program-phase-name tier-${p.tier}">${escapeHtml(p.name)}</div>
							<div class="program-phase-desc">${escapeHtml(p.desc)}</div>
						</div>
					</div>`).join("")}
			</div>
		</div>`;

	const supplements = `
		<div class="card">
			<div class="program-section-label">Supplement Stack</div>
			<table style="width:100%;border-collapse:collapse;">
				${ref.supplements.map((s) => `
					<tr style="border-bottom:1px solid var(--border);">
						<td style="padding:0.5rem 0.75rem 0.5rem 0;font-weight:600;font-size:0.85rem;width:35%;vertical-align:top;">${escapeHtml(s.name)}</td>
						<td style="padding:0.5rem 0;color:var(--text-dim);font-size:0.8rem;line-height:1.5;vertical-align:top;">${escapeHtml(s.detail)}</td>
					</tr>`).join("")}
			</table>
		</div>`;

	const equipment = `
		<div class="card">
			<div class="program-section-label">Garage Gym Equipment</div>
			<div class="program-ref-grid">
				${ref.equipment.map((cat) => `
					<div class="program-warmup-card">
						<div style="font-weight:600;font-size:0.82rem;margin-bottom:0.5rem;">${escapeHtml(cat.category)}</div>
						<div style="display:flex;flex-direction:column;gap:0.4rem;">
							${cat.items.map((i) => `<div class="muted" style="font-size:0.78rem;"><strong style="color:var(--text);">${escapeHtml(i.name)}</strong> — ${escapeHtml(i.detail)}</div>`).join("")}
						</div>
					</div>`).join("")}
			</div>
		</div>`;

	const footer = `<div class="muted" style="font-size:0.78rem;text-align:center;">${escapeHtml(ref.footer)}</div>`;

	return ouraGrid + rules + progression + supplements + equipment + footer;
}

async function renderProgram() {
	const container = document.getElementById("view-program");
	container.innerHTML = `<div class="muted">Loading…</div>`;

	const program = await loadProgram();

	container.innerHTML = `
		<div class="card">
			<div class="muted" style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(program.meta.eyebrow)}</div>
			<div style="font-size:1.4rem;font-weight:700;margin-top:0.2rem;">${escapeHtml(program.meta.title)}</div>
			<div style="margin-top:0.6rem;display:flex;flex-wrap:wrap;gap:0.4rem;">
				${program.meta.pills.map((p) => `<span class="pill">${escapeHtml(p)}</span>`).join("")}
			</div>
			<div class="program-day-nav" style="margin-top:0.9rem;">
				${["A", "B", "C"].map((id) => `<button data-day="${id}" class="${state.programDay === id ? "active" : ""}">Day ${id}</button>`).join("")}
				<button data-day="ref" class="${state.programDay === "ref" ? "active" : ""}">Reference</button>
			</div>
		</div>
		<div id="program-body"></div>
	`;

	container.querySelectorAll(".program-day-nav button").forEach((btn) => {
		btn.addEventListener("click", () => {
			state.programDay = btn.dataset.day;
			renderProgram();
		});
	});

	const body = document.getElementById("program-body");

	if (state.programDay === "ref") {
		body.innerHTML = renderProgramReferenceHtml(program.reference);
		return;
	}

	const day = program.days.find((d) => d.id === state.programDay);
	const prog = await loadProgression(day);
	body.innerHTML = renderProgramDayHtml(day, prog);

	body.querySelector("#start-program-day")?.addEventListener("click", () => {
		workoutDraft = buildDraftFromProgramDay(day, prog);
		setTab("workouts");
		toast(`Day ${day.id} loaded into Workouts with today's targets. Log RPE on every set.`);
	});
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
	renderDateNav();

	document.querySelectorAll("nav.tabs button").forEach((btn) => {
		btn.addEventListener("click", () => setTab(btn.dataset.tab));
	});

	// drop the right-edge fade once the tabs are scrolled all the way (or all fit)
	const tabs = document.querySelector("nav.tabs");
	const updateTabFade = () => tabs.classList.toggle("scrolled-end", tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1);
	tabs.addEventListener("scroll", updateTabFade, { passive: true });
	window.addEventListener("resize", updateTabFade);
	updateTabFade();

	document.getElementById("prev-day").addEventListener("click", () => setDate(shiftDate(state.date, -1)));
	document.getElementById("next-day").addEventListener("click", () => setDate(shiftDate(state.date, 1)));
	document.getElementById("today-btn").addEventListener("click", () => setDate(todayISO()));
	document.getElementById("date-input").addEventListener("change", (e) => setDate(e.target.value));

	setTab("dashboard");
});
