/**
 * Student Grouper - client-side only (no uploads).
 * CSV format: header row required. Pick a "Name" column (required) and optional "ID" column.
 */

const ROLES = ["Lead Idea", "Support Idea", "Cynic", "Organizer"];

/** @typedef {{ name: string, id?: string }} Student */

const els = {
  csvFile: document.getElementById("csvFile"),
  nameColumn: document.getElementById("nameColumn"),
  idColumn: document.getElementById("idColumn"),

  uploadError: document.getElementById("uploadError"),
  uploadInfo: document.getElementById("uploadInfo"),

  studentCount: document.getElementById("studentCount"),
  rosterBody: document.getElementById("rosterBody"),
  search: document.getElementById("search"),
  btnClearRoster: document.getElementById("btnClearRoster"),
  btnReset: document.getElementById("btnReset"),

  groupSize: document.getElementById("groupSize"),
  remainderMode: document.getElementById("remainderMode"),
  seed: document.getElementById("seed"),
  btnGenerate: document.getElementById("btnGenerate"),
  btnShuffle: document.getElementById("btnShuffle"),
  groupsError: document.getElementById("groupsError"),

  groupCount: document.getElementById("groupCount"),
  groupsWrap: document.getElementById("groupsWrap"),
  btnCopy: document.getElementById("btnCopy"),
  btnDownloadCsv: document.getElementById("btnDownloadCsv"),
};

/** @type {{ rawText: string, headers: string[], rows: Record<string,string>[] } | null } */
let parsedCsv = null;
/** @type {Student[]} */
let roster = [];
/** @type {{ groups: Array<Array<{role:string, student: Student}>>, extras: Student[] } | null } */
let lastGrouping = null;

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle("hidden", !!hidden);
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function showError(targetEl, message) {
  setText(targetEl, message);
  setHidden(targetEl, !message);
}

function showInfo(targetEl, message) {
  setText(targetEl, message);
  setHidden(targetEl, !message);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeHeader(h) {
  return String(h ?? "").trim();
}

function guessNameHeader(headers) {
  const candidates = ["name", "student", "student name", "full name"];
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx >= 0) return headers[idx];
  }
  // fallback: first non-empty header
  return headers.find((h) => h.trim().length > 0) ?? "";
}

function guessIdHeader(headers) {
  const candidates = ["id", "student id", "sid", "number"];
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx >= 0) return headers[idx];
  }
  return "";
}

function clearColumnSelect(selectEl) {
  selectEl.innerHTML = "";
}

function fillColumnSelect(selectEl, headers, allowBlank) {
  clearColumnSelect(selectEl);
  if (allowBlank) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(none)";
    selectEl.appendChild(opt);
  }
  for (const h of headers) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    selectEl.appendChild(opt);
  }
}

function setUiEnabled(enabled) {
  els.nameColumn.disabled = !enabled;
  els.idColumn.disabled = !enabled;
  els.search.disabled = !enabled;
  els.btnClearRoster.disabled = !enabled;
  els.groupSize.disabled = !enabled;
  els.remainderMode.disabled = !enabled;
  els.seed.disabled = !enabled;
  // Generate / Shuffle are also gated by roster length elsewhere.
  els.btnGenerate.disabled = !enabled;
  els.btnShuffle.disabled = !enabled;
}

function setExportEnabled(enabled) {
  els.btnCopy.disabled = !enabled;
  els.btnDownloadCsv.disabled = !enabled;
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

/**
 * Minimal CSV parser that supports:
 * - comma-separated
 * - quoted fields with escaped quotes ("")
 * - newlines inside quoted fields
 * Not intended to be a full RFC 4180 implementation, but handles typical rosters well.
 * @param {string} text
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    // avoid pushing a trailing empty row from final newline
    const isAllEmpty = row.every((x) => String(x ?? "").trim() === "");
    if (!(row.length === 1 && isAllEmpty)) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      // ignore; handle on \n
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // last field + row
  pushField();
  pushRow();

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map(normalizeHeader);

  const dataRows = rows.slice(1).filter((r) => r.some((v) => String(v ?? "").trim() !== ""));
  const objects = dataRows.map((r) => {
    /** @type {Record<string,string>} */
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c] ?? `Column ${c + 1}`;
      obj[key] = String(r[c] ?? "").trim();
    }
    return obj;
  });

  return { headers, rows: objects };
}

function rebuildRosterFromParsed() {
  if (!parsedCsv) return;

  const nameKey = els.nameColumn.value;
  const idKey = els.idColumn.value;

  if (!nameKey) {
    showError(els.uploadError, "Pick a Name column.");
    return;
  }

  /** @type {Student[]} */
  const next = [];
  const seen = new Set();

  for (const r of parsedCsv.rows) {
    const name = String(r[nameKey] ?? "").trim();
    const id = idKey ? String(r[idKey] ?? "").trim() : "";
    if (!name) continue;

    // prefer ID for uniqueness, otherwise name
    const key = id ? `id:${id}` : `name:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    next.push({ name, id: id || undefined });
  }

  roster = next;
  lastGrouping = null;
  renderRoster();
  renderGroups();
}

function renderRoster() {
  setText(els.studentCount, String(roster.length));

  const q = els.search.value.trim().toLowerCase();
  const filtered = q
    ? roster.filter((s) => s.name.toLowerCase().includes(q) || String(s.id ?? "").toLowerCase().includes(q))
    : roster;

  if (filtered.length === 0) {
    els.rosterBody.innerHTML = `<tr><td colspan="4" class="empty">${
      roster.length === 0 ? "No students loaded yet." : "No matches."
    }</td></tr>`;
    els.btnGenerate.disabled = roster.length < 4;
    els.btnShuffle.disabled = roster.length < 4;
    return;
  }

  els.rosterBody.innerHTML = filtered
    .map((s, idx) => {
      const realIndex = roster.indexOf(s);
      return `<tr>
        <td>${escapeHtml(String(idx + 1))}</td>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.id ?? "")}</td>
        <td style="text-align:right">
          <button class="btn btn--ghost" type="button" data-remove="${realIndex}">Remove</button>
        </td>
      </tr>`;
    })
    .join("");

  els.btnGenerate.disabled = roster.length < 4;
  els.btnShuffle.disabled = roster.length < 4;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str) {
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {Student[]} items
 * @param {() => number} rand
 */
function shuffle(items, rand) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateGroups() {
  showError(els.groupsError, "");
  setExportEnabled(false);
  lastGrouping = null;

  if (roster.length < 4) {
    showError(els.groupsError, "Need at least 4 students to generate groups.");
    renderGroups();
    return;
  }

  const seedStr = els.seed.value.trim();
  const seed = seedStr ? hashStringToSeed(seedStr) : Math.floor(Math.random() * 2 ** 32);
  const rand = mulberry32(seed);
  const shuffled = shuffle(roster, rand);

  const groupSize = 4;
  const remainderMode = els.remainderMode.value;

  /** @type {Array<Array<Student>>} */
  const groups = [];
  let extras = [];

  if (remainderMode === "smaller") {
    for (let i = 0; i < shuffled.length; i += groupSize) {
      groups.push(shuffled.slice(i, i + groupSize));
    }
  } else {
    const full = Math.floor(shuffled.length / groupSize) * groupSize;
    for (let i = 0; i < full; i += groupSize) {
      groups.push(shuffled.slice(i, i + groupSize));
    }
    extras = shuffled.slice(full);
  }

  const groupsWithRoles = groups.map((g) => {
    // randomize role assignment within group (but always one of each role for size 4)
    const roleOrder = shuffle(ROLES, rand);
    return g.map((student, idx) => ({
      role: roleOrder[idx] ?? "Member",
      student,
    }));
  });

  lastGrouping = { groups: groupsWithRoles, extras };
  renderGroups();
  setExportEnabled(true);
}

function renderGroups() {
  const grouping = lastGrouping;
  if (!grouping) {
    setText(els.groupCount, "0");
    els.groupsWrap.innerHTML = "";
    setExportEnabled(false);
    return;
  }

  setText(els.groupCount, String(grouping.groups.length));

  const groupCards = grouping.groups
    .map((g, i) => {
      const memberLis = g
        .map((m) => {
          return `<li class="member">
            <div class="role">${escapeHtml(m.role)}</div>
            <div class="name">${escapeHtml(m.student.name)}</div>
            <div class="sid">${escapeHtml(m.student.id ?? "")}</div>
          </li>`;
        })
        .join("");

      return `<section class="groupCard">
        <div class="groupCard__header">
          <h3 class="groupCard__title">Group ${i + 1}</h3>
          <div class="groupCard__meta">${g.length} students</div>
        </div>
        <ol class="groupList">${memberLis}</ol>
      </section>`;
    })
    .join("");

  const extrasCard =
    grouping.extras.length > 0
      ? `<section class="groupCard">
          <div class="groupCard__header">
            <h3 class="groupCard__title">Extras</h3>
            <div class="groupCard__meta">${grouping.extras.length} student(s)</div>
          </div>
          <ol class="groupList">
            ${grouping.extras
              .map(
                (s) => `<li class="member">
                  <div class="role">—</div>
                  <div class="name">${escapeHtml(s.name)}</div>
                  <div class="sid">${escapeHtml(s.id ?? "")}</div>
                </li>`
              )
              .join("")}
          </ol>
        </section>`
      : "";

  els.groupsWrap.innerHTML = groupCards + extrasCard;
}

function toExportRows() {
  if (!lastGrouping) return [];
  /** @type {Array<Record<string,string>>} */
  const out = [];
  for (let i = 0; i < lastGrouping.groups.length; i += 1) {
    const g = lastGrouping.groups[i];
    for (const m of g) {
      out.push({
        Group: String(i + 1),
        Role: m.role,
        Name: m.student.name,
        ID: m.student.id ?? "",
      });
    }
  }
  for (const s of lastGrouping.extras) {
    out.push({
      Group: "Extras",
      Role: "",
      Name: s.name,
      ID: s.id ?? "",
    });
  }
  return out;
}

function rowsToCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const lines = [];
  lines.push(headers.map(esc).join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

function toPrettyText() {
  if (!lastGrouping) return "(no groups yet)";
  const lines = [];

  for (let i = 0; i < lastGrouping.groups.length; i += 1) {
    lines.push(`Group ${i + 1}`);
    for (const m of lastGrouping.groups[i]) {
      const idPart = m.student.id ? ` (${m.student.id})` : "";
      lines.push(`- ${m.role}: ${m.student.name}${idPart}`);
    }
    lines.push("");
  }

  if (lastGrouping.extras.length > 0) {
    lines.push("Extras");
    for (const s of lastGrouping.extras) {
      const idPart = s.id ? ` (${s.id})` : "";
      lines.push(`- ${s.name}${idPart}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

async function copyGroups() {
  await navigator.clipboard.writeText(toPrettyText());
  showInfo(els.uploadInfo, "Copied groups to clipboard.");
  setTimeout(() => showInfo(els.uploadInfo, ""), 1800);
}

function downloadGroupsCsv() {
  const rows = toExportRows();
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "groups.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function resetAll() {
  parsedCsv = null;
  roster = [];
  lastGrouping = null;

  els.csvFile.value = "";
  els.search.value = "";
  els.seed.value = "";
  clearColumnSelect(els.nameColumn);
  clearColumnSelect(els.idColumn);

  setUiEnabled(false);
  setExportEnabled(false);
  showError(els.uploadError, "");
  showInfo(els.uploadInfo, "");
  showError(els.groupsError, "");

  setText(els.studentCount, "0");
  els.rosterBody.innerHTML = `<tr><td colspan="4" class="empty">Upload a CSV to see your roster here.</td></tr>`;
  renderGroups();
}

// --- Events ---

els.btnReset.addEventListener("click", () => resetAll());

els.csvFile.addEventListener("change", async (e) => {
  showError(els.uploadError, "");
  showInfo(els.uploadInfo, "");
  showError(els.groupsError, "");
  setExportEnabled(false);
  lastGrouping = null;

  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".csv")) {
    showError(els.uploadError, "Please select a .csv file.");
    return;
  }

  const text = await readFileText(file);
  const { headers, rows } = parseCsv(text);
  if (!headers.length) {
    showError(els.uploadError, "No header row found. Your CSV must have a first row of column names.");
    return;
  }
  if (rows.length === 0) {
    showError(els.uploadError, "CSV parsed, but there were no data rows.");
    return;
  }

  parsedCsv = { rawText: text, headers, rows };
  fillColumnSelect(els.nameColumn, headers, false);
  fillColumnSelect(els.idColumn, headers, true);

  const guessedName = guessNameHeader(headers);
  const guessedId = guessIdHeader(headers);
  if (guessedName) els.nameColumn.value = guessedName;
  if (guessedId) els.idColumn.value = guessedId;

  setUiEnabled(true);
  rebuildRosterFromParsed();

  showInfo(
    els.uploadInfo,
    `Loaded ${rows.length} row(s). Using "${els.nameColumn.value}" as Name` +
      (els.idColumn.value ? ` and "${els.idColumn.value}" as ID.` : ".")
  );
});

els.nameColumn.addEventListener("change", () => rebuildRosterFromParsed());
els.idColumn.addEventListener("change", () => rebuildRosterFromParsed());

els.search.addEventListener("input", () => renderRoster());

els.rosterBody.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("button[data-remove]");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-remove"));
  if (!Number.isFinite(idx)) return;
  roster.splice(idx, 1);
  lastGrouping = null;
  renderRoster();
  renderGroups();
});

els.btnClearRoster.addEventListener("click", () => {
  roster = [];
  lastGrouping = null;
  renderRoster();
  renderGroups();
});

els.btnGenerate.addEventListener("click", () => generateGroups());
els.btnShuffle.addEventListener("click", () => {
  // If a seed is present, keep it; otherwise regenerate with a fresh random seed.
  generateGroups();
});

els.btnCopy.addEventListener("click", async () => {
  try {
    await copyGroups();
  } catch {
    showError(els.groupsError, "Copy failed. Your browser may block clipboard access on file:// pages.");
  }
});

els.btnDownloadCsv.addEventListener("click", () => downloadGroupsCsv());

// Init
resetAll();

