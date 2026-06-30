import { ULogParseError, parseULog } from "./ulog-parser.js";

const PAGE_SIZE = 100;

const state = {
  parsed: null,
  topics: [],
  selectedTopic: null,
  page: 0
};

const els = {
  fileInput: document.querySelector("#fileInput"),
  fileSummary: document.querySelector("#fileSummary"),
  topicSearch: document.querySelector("#topicSearch"),
  topicList: document.querySelector("#topicList"),
  overviewGrid: document.querySelector("#overviewGrid"),
  parseHealth: document.querySelector("#parseHealth"),
  largestTopics: document.querySelector("#largestTopics"),
  topicTitle: document.querySelector("#topicTitle"),
  topicSubtitle: document.querySelector("#topicSubtitle"),
  exportCsv: document.querySelector("#exportCsv"),
  fieldSelect: document.querySelector("#fieldSelect"),
  sampleLimit: document.querySelector("#sampleLimit"),
  plot: document.querySelector("#plot"),
  prevPage: document.querySelector("#prevPage"),
  nextPage: document.querySelector("#nextPage"),
  pageStatus: document.querySelector("#pageStatus"),
  recordTable: document.querySelector("#recordTable"),
  infoTable: document.querySelector("#infoTable"),
  paramTable: document.querySelector("#paramTable"),
  formatList: document.querySelector("#formatList"),
  logList: document.querySelector("#logList")
};

els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  els.fileSummary.textContent = `Reading ${file.name}...`;
  try {
    const buffer = await file.arrayBuffer();
    state.parsed = parseULog(buffer);
    state.topics = Object.values(state.parsed.topics).sort((a, b) => b.records.length - a.records.length);
    state.selectedTopic = state.topics[0] ?? null;
    state.page = 0;
    els.fileSummary.textContent = `${file.name} - ${formatBytes(file.size)} - ${state.topics.length} topics`;
    renderAll();
  } catch (error) {
    const message = error instanceof ULogParseError ? error.message : `Unable to parse file: ${error.message}`;
    els.fileSummary.textContent = message;
  }
});

els.topicSearch.addEventListener("input", renderTopicList);
els.prevPage.addEventListener("click", () => {
  state.page = Math.max(0, state.page - 1);
  renderTopicTable();
});
els.nextPage.addEventListener("click", () => {
  if (!state.selectedTopic) return;
  state.page = Math.min(Math.ceil(state.selectedTopic.records.length / PAGE_SIZE) - 1, state.page + 1);
  renderTopicTable();
});
els.fieldSelect.addEventListener("change", renderPlot);
els.sampleLimit.addEventListener("change", renderPlot);
els.exportCsv.addEventListener("click", exportSelectedTopicCsv);

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");
  });
});

function renderAll() {
  renderTopicList();
  renderOverview();
  renderTopicDetail();
  renderMetadata();
  renderFormats();
  renderLogs();
}

function renderTopicList() {
  if (!state.parsed) return;
  const query = els.topicSearch.value.trim().toLowerCase();
  const topics = state.topics.filter((topic) => topic.key.toLowerCase().includes(query));
  els.topicList.classList.remove("empty");
  els.topicList.innerHTML = "";
  for (const topic of topics) {
    const item = document.createElement("button");
    item.className = `topicItem${topic === state.selectedTopic ? " active" : ""}`;
    item.innerHTML = `<strong>${escapeHtml(topic.key)}</strong><span>${topic.records.length.toLocaleString()} rows</span><span>${topic.fieldNames.length} fields</span>`;
    item.addEventListener("click", () => {
      state.selectedTopic = topic;
      state.page = 0;
      renderTopicList();
      renderTopicDetail();
      selectTab("topic");
    });
    els.topicList.appendChild(item);
  }
}

function renderOverview() {
  if (!state.parsed) return;
  const parsed = state.parsed;
  const totalRecords = state.topics.reduce((sum, topic) => sum + topic.records.length, 0);
  const metrics = [
    ["Version", parsed.header.version],
    ["Boot timestamp", formatTimestamp(parsed.header.timestamp)],
    ["Formats", Object.keys(parsed.formats).length.toLocaleString()],
    ["Topics", state.topics.length.toLocaleString()],
    ["Records", totalRecords.toLocaleString()],
    ["Parameters", Object.keys(parsed.parameters).length.toLocaleString()],
    ["Logs", parsed.logs.length.toLocaleString()],
    ["Dropouts", parsed.dropouts.length.toLocaleString()]
  ];
  els.overviewGrid.innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
  renderParseHealth(parsed);
  els.largestTopics.innerHTML = makeTable(
    ["Topic", "Rows", "Fields", "Start", "End"],
    state.topics.slice(0, 20).map((topic) => [
      topic.key,
      topic.records.length.toLocaleString(),
      topic.fieldNames.length,
      formatTimestamp(topic.startTimestamp),
      formatTimestamp(topic.endTimestamp)
    ])
  );
}

function renderParseHealth(parsed) {
  const totalParseErrors = state.topics.reduce((sum, topic) => sum + topic.parseErrors, 0);
  const inactiveSubscriptions = Object.values(parsed.subscriptions).filter((subscription) => !subscription.active).length;
  const messageTypes = Object.entries(parsed.stats.messageTypes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}: ${count.toLocaleString()}`)
    .join(", ");
  const rows = [
    ["Total messages", parsed.stats.messages.toLocaleString()],
    ["Data records", parsed.stats.dataMessages.toLocaleString()],
    ["Message types", messageTypes],
    ["Unknown messages", parsed.unknownMessages.length.toLocaleString()],
    ["Topic parse errors", totalParseErrors.toLocaleString()],
    ["Inactive subscriptions", inactiveSubscriptions.toLocaleString()],
    ["Flag/sync messages", parsed.flags.length.toLocaleString()]
  ];
  els.parseHealth.innerHTML = makeTable(["Metric", "Value"], rows);
}

function renderTopicDetail() {
  const topic = state.selectedTopic;
  if (!topic) return;
  els.topicTitle.textContent = topic.key;
  els.topicSubtitle.textContent = `${topic.records.length.toLocaleString()} records, ${topic.fieldNames.length} fields${topic.parseErrors ? `, ${topic.parseErrors} parse errors` : ""}`;
  els.exportCsv.disabled = topic.records.length === 0;
  els.fieldSelect.innerHTML = topic.numericFieldNames.map((field) => `<option value="${escapeAttr(field)}">${escapeHtml(field)}</option>`).join("");
  renderPlot();
  renderTopicTable();
}

function renderPlot() {
  const topic = state.selectedTopic;
  const ctx = els.plot.getContext("2d");
  const width = els.plot.width;
  const height = els.plot.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dce2ea";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = 30 + i * ((height - 60) / 4);
    ctx.beginPath();
    ctx.moveTo(44, y);
    ctx.lineTo(width - 18, y);
    ctx.stroke();
  }
  if (!topic || topic.records.length === 0 || topic.numericFieldNames.length === 0) {
    drawPlotText(ctx, "No numeric data available");
    return;
  }
  const field = els.fieldSelect.value || topic.numericFieldNames[0];
  const limit = Math.max(10, Number(els.sampleLimit.value) || 500);
  const rows = topic.records.slice(0, limit).filter((row) => Number.isFinite(row[field]));
  if (rows.length < 2) {
    drawPlotText(ctx, "Not enough samples to plot");
    return;
  }

  let min = Math.min(...rows.map((row) => row[field]));
  let max = Math.max(...rows.map((row) => row[field]));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const left = 44;
  const right = width - 18;
  const top = 24;
  const bottom = height - 36;
  ctx.fillStyle = "#687385";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.fillText(max.toPrecision(5), 8, top + 4);
  ctx.fillText(min.toPrecision(5), 8, bottom);
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  rows.forEach((row, index) => {
    const x = left + (index / (rows.length - 1)) * (right - left);
    const y = bottom - ((row[field] - min) / (max - min)) * (bottom - top);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderTopicTable() {
  const topic = state.selectedTopic;
  if (!topic) return;
  const total = topic.records.length;
  const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  state.page = Math.min(state.page, maxPage);
  const start = state.page * PAGE_SIZE;
  const rows = topic.records.slice(start, start + PAGE_SIZE);
  els.recordTable.innerHTML = makeTable(topic.fieldNames, rows.map((row) => topic.fieldNames.map((field) => formatCell(row[field]))));
  els.pageStatus.textContent = total ? `${(start + 1).toLocaleString()}-${(start + rows.length).toLocaleString()} of ${total.toLocaleString()}` : "0-0 of 0";
  els.prevPage.disabled = state.page === 0;
  els.nextPage.disabled = state.page >= maxPage;
}

function renderMetadata() {
  if (!state.parsed) return;
  els.infoTable.innerHTML = objectTable(state.parsed.info);
  els.paramTable.innerHTML = objectTable(state.parsed.parameters);
}

function renderFormats() {
  if (!state.parsed) return;
  els.formatList.innerHTML = Object.values(state.parsed.formats)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((format) => `<details class="formatBlock"><summary>${escapeHtml(format.name)} (${format.fields.length} fields)</summary><pre>${escapeHtml(format.raw)}</pre></details>`)
    .join("");
}

function renderLogs() {
  if (!state.parsed) return;
  els.logList.innerHTML = makeTable(
    ["Level", "Timestamp", "Message"],
    state.parsed.logs.map((log) => [log.level, formatTimestamp(log.timestamp), log.message])
  );
}

function exportSelectedTopicCsv() {
  const topic = state.selectedTopic;
  if (!topic) return;
  const lines = [topic.fieldNames.join(",")];
  for (const record of topic.records) {
    lines.push(topic.fieldNames.map((field) => csvCell(record[field])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${topic.key.replace(/[^A-Za-z0-9_.-]/g, "_")}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function makeTable(headers, rows) {
  if (!rows.length) return `<div class="empty">No rows</div>`;
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function objectTable(object) {
  const rows = Object.entries(object)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : JSON.stringify(value)]);
  return makeTable(["Name", "Value"], rows);
}

function selectTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`).click();
}

function drawPlotText(ctx, text) {
  ctx.fillStyle = "#687385";
  ctx.font = "16px Segoe UI, sans-serif";
  ctx.fillText(text, 44, 156);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTimestamp(value) {
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${(value / 1_000_000).toFixed(3)}s`;
}

function formatCell(value) {
  return typeof value === "number" && !Number.isInteger(value) ? Number(value.toPrecision(8)) : value;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
