const fs = require("fs");

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
// Function 1
// ============================================================
function getShiftDuration(startTime, endTime) {
  const start = time12hToSeconds(startTime);
  const end = time12hToSeconds(endTime);
  return secondsToHms(end - start);
}

// ============================================================
// Function 2
// Delivery hours: 8:00 AM to 10:00 PM (inclusive)
// Idle = time before 8:00 AM + time after 10:00 PM
// ============================================================
function getIdleTime(startTime, endTime) {
  const start = time12hToSeconds(startTime);
  const end = time12hToSeconds(endTime);

  const deliveryStart = 8 * 3600;  // 08:00:00
  const deliveryEnd = 22 * 3600;   // 22:00:00

  let idle = 0;

  if (start < deliveryStart) idle += (Math.min(end, deliveryStart) - start);
  if (end > deliveryEnd) idle += (end - Math.max(start, deliveryEnd));

  return secondsToHms(idle);
}

// ============================================================
// Function 3
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
  const shift = hmsToSeconds(shiftDuration);
  const idle = hmsToSeconds(idleTime);
  return secondsToHms(shift - idle);
}

// ============================================================
// Function 4
// Normal quota: 8:24:00
// Eid quota (Apr 10–30, 2025): 6:00:00
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
// Function 5 (TEMP so tests don't crash yet)
// Replace later with full implementation.
// ============================================================
function addShiftRecord(textFile, shiftObj) {
  return {};
}

// ============================================================
// Function 6–10 (leave TODO for now)
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
