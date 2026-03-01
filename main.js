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

function getShiftDuration(startTime, endTime) {
  const start = time12hToSeconds(startTime);
  const end = time12hToSeconds(endTime);
  return secondsToHms(end - start);
}

function getIdleTime(startTime, endTime) {
  const start = time12hToSeconds(startTime);
  const end = time12hToSeconds(endTime);

  const deliveryStart = 8 * 3600;
  const deliveryEnd = 22 * 3600;

  let idle = 0;
  if (start < deliveryStart) idle += (Math.min(end, deliveryStart) - start);
  if (end > deliveryEnd) idle += (end - Math.max(start, deliveryEnd));

  return secondsToHms(idle);
}

function getActiveTime(shiftDuration, idleTime) {
  const shift = hmsToSeconds(shiftDuration);
  const idle = hmsToSeconds(idleTime);
  return secondsToHms(shift - idle);
}

function metQuota(date, activeTime) {
  const active = hmsToSeconds(activeTime);

  const normalQuota = 8 * 3600 + 24 * 60;
  const eidQuota = 6 * 3600;

  const isEid = date >= "2025-04-10" && date <= "2025-04-30";
  const needed = isEid ? eidQuota : normalQuota;

  return active >= needed;
}

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
function setBonus(textFile, driverID, date, newValue) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n");

  const targetId = driverID.trim();
  const targetDate = date.trim();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    const lineID = cols[0].trim();
    const lineDate = cols[2].trim();
    if (lineID === targetId && lineDate === targetDate) {
      cols[9] = String(newValue);
      lines[i] = cols.join(",");
      break;
    }
  }

  fs.writeFileSync(textFile, lines.join("\n"), "utf8");
}

function countBonusPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n");

  const targetId = driverID.trim();
  const targetMonth = parseInt(month, 10);

  let exists = false;
  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    const lineID = cols[0].trim();
    const lineDate = cols[2].trim();
    const hasBonus = cols[9] && cols[9].trim() === "true";

    if (lineID === targetId) {
      exists = true;
      const m = parseInt(lineDate.split("-")[1], 10);
      if (m === targetMonth && hasBonus) count++;
    }
  }

  return exists ? count : -1;
}

function getTotalActiveHoursPerMonth(textFile, driverID, month) {
  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n");

  const targetId = driverID.trim();
  const targetMonth = Number(month);

  let totalSeconds = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    const lineID = cols[0].trim();
    const lineDate = cols[2].trim();
    const activeTime = cols[7] ? cols[7].trim() : "0:00:00";

    if (lineID === targetId) {
      const m = parseInt(lineDate.split("-")[1], 10);
      if (m === targetMonth) {
        totalSeconds += hmsToSeconds(activeTime);
      }
    }
  }

  return secondsToHms(totalSeconds);
}

function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
  const targetId = driverID.trim();
  const targetMonth = Number(month);

  // Read driver rates to get day off
  const rateContent = fs.readFileSync(rateFile, "utf8").trim();
  const rateLines = rateContent ? rateContent.split("\n") : [];

  let dayOff = null;
  for (const line of rateLines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const id = cols[0].trim();
    if (id === targetId) {
      dayOff = cols[1].trim();
      break;
    }
  }

  const content = fs.readFileSync(textFile, "utf8");
  const lines = content.split("\n");

  let totalSeconds = 0;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(",");
    const lineID = cols[0].trim();
    const lineDate = cols[2].trim();

    if (lineID !== targetId) continue;

    const m = parseInt(lineDate.split("-")[1], 10);
    if (m !== targetMonth) continue;

    // Skip days off
    if (dayOff) {
      const [y, mo, day] = lineDate.split("-").map(Number);
      const d = new Date(y, mo - 1, day);
      const weekdayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ];
      const dayName = weekdayNames[d.getDay()];
      if (dayName === dayOff) continue;
    }

    const isEid =
      lineDate >= "2025-04-10" && lineDate <= "2025-04-30";

    const dailySeconds = isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;
    totalSeconds += dailySeconds;
  }

  // Reduce required hours by 2 hours per bonus
  const reduction = (Number(bonusCount) || 0) * 2 * 3600;
  totalSeconds = Math.max(0, totalSeconds - reduction);

  return secondsToHms(totalSeconds);
}

function getNetPay(driverID, actualHours, requiredHours, rateFile) {
  const targetId = driverID.trim();

  const rateContent = fs.readFileSync(rateFile, "utf8").trim();
  const rateLines = rateContent ? rateContent.split("\n") : [];

  let basePay = 0;
  let tier = 0;

  for (const line of rateLines) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    const id = cols[0].trim();
    if (id === targetId) {
      basePay = parseInt(cols[2], 10);
      tier = parseInt(cols[3], 10);
      break;
    }
  }

  const actualSec = hmsToSeconds(actualHours);
  const requiredSec = hmsToSeconds(requiredHours);

  if (actualSec >= requiredSec) return basePay;

  const diffSec = requiredSec - actualSec;

  const allowedByTier = {
    1: 50,
    2: 20,
    3: 10,
    4: 3
  }[tier] || 0;

  let remainingSec = diffSec - allowedByTier * 3600;
  if (remainingSec <= 0) return basePay;

  const billableMissingHours = Math.floor(remainingSec / 3600);

  const deductionRatePerHour = Math.floor(basePay / 185);
  const salaryDeduction = billableMissingHours * deductionRatePerHour;

  return basePay - salaryDeduction;
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
