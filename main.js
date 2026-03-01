const fs = require("fs");

// ---------- Helpers ----------
function time12hToSeconds(t) {
  t = t.trim().toLowerCase();
  const [clock, period] = t.split(/\s+/);
  let [h, m, s] = clock.split(":").map(Number);

  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;

  return h * 3600 + m * 60 + s;
}

function hmsToSeconds(hms) {
  const [h, m, s] = hms.trim().split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function secondsToHms(total) {
  const h = Math.floor(total / 3600);
  const rem = total % 3600;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// ============================================================
function getShiftDuration(startTime, endTime) {
  const start = time12hToSeconds(startTime);
  const end = time12hToSeconds(endTime);
  return secondsToHms(end - start);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// ============================================================
function getIdleTime(startTime, endTime) {
  const start = time12hToSeconds(startTime);
  const end = time12hToSeconds(endTime);

  const deliveryStart = 8 * 3600;
  const deliveryEnd = 22 * 3600;

  let idle = 0;
  if (start < deliveryStart) idle += Math.min(end, deliveryStart) - start;
  if (end > deliveryEnd) idle += end - Math.max(start, deliveryEnd);

  return secondsToHms(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
  const shift = hmsToSeconds(shiftDuration);
  const idle = hmsToSeconds(idleTime);
  return secondsToHms(shift - idle);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// ============================================================
function metQuota(date, activeTime) {
  const active = hmsToSeconds(activeTime);

  const normalQuota = 8 * 3600 + 24 * 60; // 8:24:00
  const eidQuota = 6 * 3600;              // 6:00:00

  const isEid = date >= "2025-04-10" && date <= "2025-04-30";
  const needed = isEid ? eidQuota : normalQuota;

  return active >= needed;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// ============================================================
function addShiftRecord(textFile, shiftObj) {
  const content = fs.readFileSync(textFile, "utf8").trim();
  const lines = content ? content.split("\n") : [];

  const id = shiftObj.driverID.trim();
  const date = shiftObj.date.trim();

  for (const line of lines) {
    const cols = line.split(",");
    const lineID = cols[0].trim();
    const lineDate = cols[2].trim();
    if (lineID === id && lineDate === date) return {};
  }

  const start = shiftObj.startTime;
  const end = shiftObj.endTime;

  const shiftDuration = getShiftDuration(start, end);
  const idleTime = getIdleTime(start, end);
  const activeTime = getActiveTime(shiftDuration, idleTime);
  const quotaMet = metQuota(date, activeTime);

  const result = {
    driverID: shiftObj.driverID,
    driverName: shiftObj.driverName,
    date: shiftObj.date,
    startTime: shiftObj.startTime,
    endTime: shiftObj.endTime,
    shiftDuration,
    idleTime,
    activeTime,
    metQuota: quotaMet,
    hasBonus: false
  };

  const newLine = [
    result.driverID,
    result.driverName,
    result.date,
    result.startTime,
    result.endTime,
    result.shiftDuration,
    result.idleTime,
    result.activeTime,
    result.metQuota,
    result.hasBonus
  ].join(",");

  let lastIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const lineID = lines[i].split(",")[0].trim();
    if (lineID === id) lastIndex = i;
  }

  if (lastIndex === -1) lines.push(newLine);
  else lines.splice(lastIndex + 1, 0, newLine);

  fs.writeFileSync(textFile, lines.join("\n") + "\n", "utf8");
  return result;
}
// ============================================================
// Function 6–10 (stubs for now)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {}
function countBonusPerMonth(textFile, driverID, month) {}
function getTotalActiveHoursPerMonth(textFile, driverID, month) {}
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {}
function getNetPay(driverID, actualHours, requiredHours, rateFile) {}

module.exports = {
  getShiftDuration,
  getIdleTime,
  getActiveTime,
  metQuota,
  addShiftRecord,
  setBonus,
  countBonusPerMonth,
  getTotalActiveHoursPerMonth,
  getRequiredHoursPerMonth,
  getNetPay
};
