const SHEET_ID = "11DnXOPcRlp8HTvIMh0eeRx94076-x1l90aV89tZV6wA";

const SHEETS = {
  funnel: "Overall Funnel",
  campus: "Campus Breakdown",
  outcomes: "Dash Outcomes",
  paid: "Dash Paid",
  paidData: "Data Paid Altius",
};

const DATASETS = [
  "Data Paid Altius",
  "Data NSAT No Show",
  "Data NSAT Failed",
  "Data NSAT Passed",
  "Data NSAT Other Pending",
  "Data Interview No Show",
  "Data Interview Failed",
  "Data Interview Passed",
  "Data Passed No Counselling",
  "Data Counselling No Show",
  "Data Counselling Cancelled",
  "Data Not Interested",
  "Data OL Released",
];

const state = { data: {}, charts: {}, activeDataset: DATASETS[0], datasetRows: { headers: [], rows: [] } };
const numberFmt = new Intl.NumberFormat("en-IN");

function jsonpName() {
  return `sheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function loadSheet(sheetName, range = "") {
  return new Promise((resolve, reject) => {
    const cb = jsonpName();
    const params = new URLSearchParams({ tqx: `out:json;responseHandler:${cb}`, sheet: sheetName });
    if (range) params.set("range", range);
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading ${sheetName}`));
    }, 30000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      delete window[cb];
    }

    window[cb] = (response) => {
      cleanup();
      if (response.status !== "ok") {
        reject(new Error(`${sheetName}: ${response.errors?.[0]?.detailed_message || response.status}`));
        return;
      }
      resolve(tableToRows(response.table));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`Could not load ${sheetName}`));
    };
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params.toString()}`;
    document.body.appendChild(script);
  });
}

function tableToRows(table) {
  const headers = table.cols.map((col, index) => col.label || col.id || `Column ${index + 1}`);
  const rows = (table.rows || []).map((row) =>
    headers.reduce((item, header, index) => {
      item[header] = row.c[index]?.v ?? "";
      return item;
    }, {}),
  );
  return { headers, rows };
}

function getByKey(rows, key, valueField = "Students") {
  const row = rows.find((item) => item.Step === key || item.Metric === key || item.Campus === key);
  return toNum(row?.[valueField]);
}

function toNum(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCell(value) {
  if (typeof value === "number") return numberFmt.format(value);
  return value;
}

function statusClass(value) {
  const lower = String(value).toLowerCase();
  if (lower.includes("failed") || lower.includes("absent") || lower.includes("cancelled")) return "status-danger";
  if (lower.includes("pending") || lower.includes("waitlist") || lower.includes("not interested")) return "status-warn";
  if (lower.includes("passed") || lower.includes("paid") || lower.includes("present")) return "status-good";
  return "";
}

function renderTable(targetId, headers, rows, options = {}) {
  const numeric = options.numeric || [];
  const visibleRows = rows.slice(0, options.limit ?? rows.length);
  document.getElementById(targetId).innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((h) => `<th class="${numeric.includes(h) ? "num" : ""}">${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>
          ${visibleRows
            .map(
              (row) => `<tr>${headers
                .map((h) => {
                  const cls = numeric.includes(h) ? "num" : statusClass(row[h]);
                  return `<td class="${cls}">${escapeHtml(formatCell(row[h]))}</td>`;
                })
                .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function createChart(id, config) {
  if (state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new Chart(document.getElementById(id), config);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function funnelStages() {
  const rows = state.data.funnel.rows;
  return [
    ["NSAT paid registrations", "NSAT paid registrations"],
    ["NSAT showed up", "NSAT showed up / started"],
    ["NSAT passed", "NSAT passed"],
    ["Interview passed", "Interview passed"],
    ["Counselling attended", "Counselling attended"],
    ["OL released", "OL released"],
    ["Paid", "Paid"],
  ].map(([label, key]) => ({ label, key, value: getByKey(rows, key) }));
}

function renderOverview() {
  const rows = state.data.funnel.rows;
  const kpis = [
    ["NSAT paid registrations", "Base"],
    ["NSAT showed up / started", "Show-up"],
    ["NSAT passed", "Passed NSAT"],
    ["Interview passed", "Passed interview"],
    ["Counselling attended", "Counselled"],
    ["Paid", "Block Fee Paid"],
  ];
  document.getElementById("kpis").innerHTML = kpis
    .map(([key, note]) => `<div class="kpi"><div class="label">${note}</div><div class="value">${numberFmt.format(getByKey(rows, key))}</div><div class="note">${key}</div></div>`)
    .join("");

  const stages = funnelStages();
  const max = Math.max(...stages.map((s) => s.value), 1);
  document.getElementById("funnelBars").innerHTML = stages
    .map((stage) => `<div class="funnel-row"><strong>${escapeHtml(stage.label)}</strong><div class="bar-track"><div class="bar-fill" style="width:${(stage.value / max) * 100}%"></div></div><div class="funnel-value">${numberFmt.format(stage.value)}</div></div>`)
    .join("");

  createChart("stageChart", {
    type: "bar",
    data: { labels: stages.map((s) => s.label), datasets: [{ label: "Students", data: stages.map((s) => s.value), backgroundColor: "#2563eb" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  const conversions = stages.map((stage, i) => (i === 0 ? 1 : stage.value / Math.max(stages[i - 1].value, 1)));
  createChart("conversionChart", {
    type: "line",
    data: { labels: stages.map((s) => s.label), datasets: [{ label: "Conversion", data: conversions, borderColor: "#0f766e", backgroundColor: "#0f766e", tension: 0.25 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: (v) => pct(v) } } } },
  });

  const leakage = [
    ["NSAT no show", "NSAT did not show up", "Paid registrations not found as NSAT started/completed"],
    ["NSAT failed", "NSAT failed", "Retest / prep pool"],
    ["Interview failed", "Interview failed", "Second chance / review pool"],
    ["Passed but no counselling", "Passed but not in counselling sheet", "Needs counselling booking"],
    ["Counselling no show", "Counselling did not attend", "Needs reschedule"],
    ["OL not paid", null, "OL released minus Block Fee Paid"],
  ].map(([queue, key, definition]) => ({
    Queue: queue,
    Students: key ? getByKey(rows, key) : getByKey(rows, "OL released") - getByKey(rows, "Paid"),
    Definition: definition,
  }));
  renderTable("leakageTable", ["Queue", "Students", "Definition"], leakage, { numeric: ["Students"] });
}

function renderCampus() {
  const rows = state.data.campus.rows.filter((r) => !["#N/A"].includes(String(r.Campus)));
  renderTable("campusTable", state.data.campus.headers, rows, { numeric: ["NSAT Paid Registrations", "Counselling Booked", "Counselling Attended", "OL Released", "Paid"] });
  const chartRows = rows.filter((r) => !["(blank)", "#N/A", ""].includes(String(r.Campus)));
  createChart("campusPaidChart", {
    type: "bar",
    data: { labels: chartRows.map((r) => r.Campus), datasets: [{ label: "Paid", data: chartRows.map((r) => toNum(r.Paid)), backgroundColor: "#2563eb" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
  createChart("campusRateChart", {
    type: "bar",
    data: { labels: chartRows.map((r) => r.Campus), datasets: [{ label: "Paid / Registered", data: chartRows.map((r) => toNum(r.Paid) / Math.max(toNum(r["NSAT Paid Registrations"]), 1)), backgroundColor: "#0f766e" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => pct(v) } } } },
  });
}

function renderOutcomes() {
  const rows = state.data.outcomes.rows.filter((r) => r["Action queue"]);
  renderTable("outcomeTable", state.data.outcomes.headers, rows, { numeric: ["Students"] });
  createChart("outcomeChart", {
    type: "bar",
    data: { labels: rows.map((r) => r["Action queue"]), datasets: [{ label: "Students", data: rows.map((r) => toNum(r.Students)), backgroundColor: "#b45309" }] },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
}

function renderPaid() {
  const paidRows = state.data.paid.rows;
  renderTable("paidMetrics", ["Metric", "Value", "Source"], paidRows.slice(0, 3), { numeric: ["Value"] });
  const campusRows = paidRows.slice(4).filter((r) => r.Campus);
  createChart("paidPieChart", {
    type: "pie",
    data: { labels: campusRows.map((r) => r.Campus), datasets: [{ data: campusRows.map((r) => toNum(r["Block Fee Paid"])), backgroundColor: ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#64748b"] }] },
    options: { responsive: true, maintainAspectRatio: false },
  });
  const sampleHeaders = ["user_id", "full_name", "email", "phone", "campus_preference", "payment_date", "user_stage"];
  renderTable("paidSample", sampleHeaders, state.data.paidData.rows, { limit: 30 });
}

function setupExplorer() {
  const select = document.getElementById("datasetSelect");
  select.innerHTML = DATASETS.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  select.value = state.activeDataset;
  select.addEventListener("change", async () => {
    state.activeDataset = select.value;
    await loadExplorerDataset();
  });
  document.getElementById("searchInput").addEventListener("input", renderExplorerTable);
  document.getElementById("statusInput").addEventListener("input", renderExplorerTable);
  document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("searchInput").value = "";
    document.getElementById("statusInput").value = "";
    renderExplorerTable();
  });
}

async function loadExplorerDataset() {
  const meta = document.getElementById("explorerMeta");
  meta.textContent = `Loading ${state.activeDataset}...`;
  try {
    state.datasetRows = await loadSheet(state.activeDataset);
    renderExplorerTable();
  } catch (error) {
    state.datasetRows = { headers: [], rows: [] };
    document.getElementById("explorerTable").innerHTML = "";
    meta.textContent = `${state.activeDataset} is not available yet. ${error.message}`;
  }
}

function renderExplorerTable() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const status = document.getElementById("statusInput").value.trim().toLowerCase();
  const headers = state.datasetRows.headers || [];
  const filtered = (state.datasetRows.rows || []).filter((row) => {
    const haystack = headers.map((h) => row[h]).join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!status || haystack.includes(status));
  });
  document.getElementById("explorerMeta").textContent = `${numberFmt.format(filtered.length)} rows shown from ${state.activeDataset}`;
  renderTable("explorerTable", headers.slice(0, 28), filtered, { limit: 250 });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
      button.classList.add("is-active");
      document.getElementById(button.dataset.view).classList.add("is-active");
      Object.values(state.charts).forEach((chart) => chart.resize());
    });
  });
}

async function loadCore() {
  document.getElementById("refreshStamp").textContent = "Loading...";
  const [funnel, campus, outcomes, paid] = await Promise.all([
    loadSheet(SHEETS.funnel),
    loadSheet(SHEETS.campus),
    loadSheet(SHEETS.outcomes, "A4:D14"),
    loadSheet(SHEETS.paid, "A4:C14"),
  ]);
  let paidData = { headers: [], rows: [] };
  try {
    paidData = await loadSheet(SHEETS.paidData);
  } catch (error) {
    showToast(`Paid sample skipped: ${error.message}`);
  }
  state.data = { funnel, campus, outcomes, paid, paidData };
  renderOverview();
  renderCampus();
  renderOutcomes();
  renderPaid();
  document.getElementById("refreshStamp").textContent = `Updated ${new Date().toLocaleString("en-IN")}`;
}

async function init() {
  setupTabs();
  setupExplorer();
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    try {
      await loadCore();
      await loadExplorerDataset();
      showToast("Dashboard refreshed");
    } catch (error) {
      showToast(error.message);
    }
  });
  try {
    await loadCore();
    await loadExplorerDataset();
  } catch (error) {
    showToast(error.message);
  }
}

init();
