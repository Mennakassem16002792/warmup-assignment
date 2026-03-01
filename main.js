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
function setBonus(textFile, driverID, date, newValue) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.trim() ? content.trim().split("\n") : [];

  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const id = cols[0]?.trim();
    const d = cols[2]?.trim();

    if (id === driverID && d === date) {
      cols[9] = String(Boolean(newValue)); // hasBonus column
      lines[i] = cols.join(",");
      changed = true;
      break;
    }
  }

  if (changed) fs.writeFileSync(textFile, lines.join("\n") + "\n", "utf8");
}

function countBonusPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8").trim();
  const lines = content ? content.split("\n") : [];

  const targetMonth = String(parseInt(month, 10)).padStart(2, "0");

  let foundDriver = false;
  let count = 0;

  for (const line of lines) {
    const cols = line.split(",");
    const id = cols[0]?.trim();
    const date = cols[2]?.trim(); // yyyy-mm-dd
    const hasBonus = (cols[9] || "").trim().toLowerCase() === "true";

    if (id !== driverID) continue;
    foundDriver = true;

    const m = date.substring(5, 7);
    if (m === targetMonth && hasBonus) count++;
  }

  return foundDriver ? count : -1;
}

function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8").trim();
  const lines = content ? content.split("\n") : [];
  const targetMonth = String(parseInt(month, 10)).padStart(2, "0");

  let totalSeconds = 0;

  for (const line of lines) {
    const cols = line.split(",");
    const id = cols[0]?.trim();
    const date = cols[2]?.trim();
    const activeTime = (cols[7] || "").trim(); // activeTime column

    if (id !== driverID) continue;
    if (date.substring(5, 7) !== targetMonth) continue;

    totalSeconds += hmsToSeconds(activeTime);
  }

  return secondsToHms(totalSeconds);
}

function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  const rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

  let tier = null;
  for (const line of rates) {
    const [id, dayOff, basePay, t] = line.split(",").map(x => x.trim());
    if (id === driverID) {
      tier = Number(t);
      break;
    }
  }

  if (tier === null) return undefined;

  const baseRequiredSeconds = (16 * 3600 + 48 * 60) + (tier - 1) * (12 * 3600);
  const requiredSeconds = Math.max(0, baseRequiredSeconds - Number(bonusCount) * (2 * 3600));

  return secondsToHms(requiredSeconds);
}

function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const rates = fs.readFileSync(rateFile, "utf8").trim().split("\n");

  let basePay = null;
  let tier = null;

  for (const line of rates) {
    const [id, dayOff, pay, t] = line.split(",").map(x => x.trim());
    if (id === driverID) {
      basePay = Number(pay);
      tier = Number(t);
      break;
    }
  }

  if (basePay === null || tier === null) return undefined;

  const actualSec = hmsToSeconds(actualHours);
  const requiredSec = hmsToSeconds(requiredHours);

  if (actualSec >= requiredSec) return basePay;

  const deficitSec = requiredSec - actualSec;
  const deficitHoursRoundedUp = Math.ceil(deficitSec / 3600);

  const allowedMissingHours = tier - 1;
  const hoursToDeduct = Math.max(0, deficitHoursRoundedUp - allowedMissingHours);

  const deductionPerHour = Math.floor(basePay / 185);
  const net = basePay - hoursToDeduct * deductionPerHour;

  return net;
}
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
