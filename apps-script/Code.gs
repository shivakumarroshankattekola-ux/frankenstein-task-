/**
 * JARVIS Task Command Center - Google Apps Script backend
 * 1. Create a Google Sheet and copy its spreadsheet ID.
 * 2. Set SPREADSHEET_ID below.
 * 3. Run setupSheet() once from the Apps Script editor and authorize.
 * 4. Deploy as Web app: Execute as Me, Who has access: Anyone.
 */
const SPREADSHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const SHEET_NAME = "Tasks";
const HEADERS = ["ID", "Title", "Description", "Priority", "Due Date", "Category", "Completed", "Created At", "Updated At", "Due Time"];

function doGet() {
  try {
    const tasks = readTasks_();
    return json_({ success: true, tasks: tasks });
  } catch (err) {
    return json_({ success: false, message: err.message, tasks: [] });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "");
    let result;
    if (action === "create") result = createTask_(payload.task || {});
    else if (action === "update") result = updateTask_(payload.task || {});
    else if (action === "toggle") result = toggleTask_(payload.id, payload.completed);
    else if (action === "delete") result = deleteTask_(payload.id);
    else throw new Error("Unknown action.");
    return json_({ success: true, ...result });
  } catch (err) {
    return json_({ success: false, message: err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function setupSheet() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setBackground("#073047").setFontColor("#35d9ff").setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return "Tasks sheet is ready.";
}

function readTasks_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  return values.filter(row => row[0] !== "").map(rowToTask_);
}

function createTask_(input) {
  const title = clean_(input.title, 140);
  if (!title) throw new Error("Task title is required.");
  const now = new Date();
  const task = normalizeTask_(input);
  task.id = Utilities.getUuid();
  task.completed = false;
  const row = [task.id, task.title, task.description, task.priority, task.dueDate, task.category, task.completed, now, now, task.dueTime];
  const sheet = getSheet_();
  sheet.appendRow(row);
  return { task: task };
}

function updateTask_(input) {
  const id = clean_(input.id, 100);
  if (!id) throw new Error("Task ID is missing.");
  const task = normalizeTask_(input);
  task.id = id;
  const sheet = getSheet_(), rowNum = findRow_(sheet, id);
  if (!rowNum) throw new Error("Task not found. Refresh and try again.");
  const old = rowToTask_(sheet.getRange(rowNum, 1, 1, HEADERS.length).getValues()[0]);
  task.completed = old.completed;
  sheet.getRange(rowNum, 2, 1, 5).setValues([[task.title, task.description, task.priority, task.dueDate, task.category]]);
  sheet.getRange(rowNum, 10).setValue(task.dueTime);
  sheet.getRange(rowNum, 9).setValue(new Date());
  return { task: task };
}

function toggleTask_(id, completed) {
  id = clean_(id, 100);
  const sheet = getSheet_(), rowNum = findRow_(sheet, id);
  if (!rowNum) throw new Error("Task not found.");
  sheet.getRange(rowNum, 7).setValue(Boolean(completed));
  sheet.getRange(rowNum, 9).setValue(new Date());
  const task = rowToTask_(sheet.getRange(rowNum, 1, 1, HEADERS.length).getValues()[0]);
  return { task: task };
}

function deleteTask_(id) {
  const sheet = getSheet_(), rowNum = findRow_(sheet, clean_(id, 100));
  if (!rowNum) throw new Error("Task not found.");
  sheet.deleteRow(rowNum);
  return { id: id };
}

function normalizeTask_(input) {
  const priority = ["High", "Medium", "Low"].includes(input.priority) ? input.priority : "Medium";
  const category = ["Personal", "Work", "Study", "Health", "Other"].includes(input.category) ? input.category : "Personal";
  return {
    id: clean_(input.id, 100),
    title: clean_(input.title, 140),
    description: clean_(input.description, 600),
    priority: priority,
    dueDate: validDate_(input.dueDate),
    dueTime: validTime_(input.dueTime),
    category: category,
    completed: Boolean(input.completed)
  };
}

function rowToTask_(row) {
  return {
    id: String(row[0] || ""),
    title: String(row[1] || ""),
    description: String(row[2] || ""),
    priority: String(row[3] || "Medium"),
    dueDate: dateString_(row[4]),
    category: String(row[5] || "Personal"),
    completed: row[6] === true || String(row[6]).toLowerCase() === "true",
    createdAt: row[7] instanceof Date ? row[7].toISOString() : String(row[7] || ""),
    updatedAt: row[8] instanceof Date ? row[8].toISOString() : String(row[8] || ""),
    dueTime: timeString_(row[9])
  };
}

function findRow_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return 0;
  const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function getSheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID.indexOf("PASTE_YOUR") === 0) {
    throw new Error("Set SPREADSHEET_ID in Code.gs first.");
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    // Add the new Due Time field to existing sheets without shifting legacy columns.
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    if (existingHeaders.indexOf("Due Time") === -1) {
      sheet.getRange(1, lastCol + 1).setValue("Due Time");
    }
  }
  return sheet;
}

function clean_(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}
function validDate_(value) {
  const s = clean_(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function validTime_(value) {
  const s = clean_(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : "";
}
function timeString_(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  const s = String(value).trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return s;
  const match = s.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}
function dateString_(value) {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
