// =======================
// CONFIG
// =======================
const USERS_SHEET = "Users";
const VISITS_SHEET = "Visits";

// ========= LOGIN =========
function loginUser(nationalID, password) {
  const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
  const data = sh.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) == String(nationalID) && String(data[i][1]) == String(password)) {
      return {
        success: true,
        nationalID: String(data[i][0]),
        name: String(data[i][2]),
        role: String(data[i][3] || "").toLowerCase()
      };
    }
  }
  return { success: false, message: "Invalid credentials" };
}

// ========= SAVE VISIT (MULTI SKU SUPPORT) =========
function saveVisit(record) {
  const sh = SpreadsheetApp.getActive().getSheetByName(VISITS_SHEET);

  // Format SKU structure into readable text
  let skuFormatted = "";
  let totalCartons = 0;

  if (record.skus && record.skus.length > 0) {
    skuFormatted = record.skus
      .map(s => `${s.name}:${s.qty}`)
      .join(" | ");

    totalCartons = record.skus.reduce((sum, s) => sum + Number(s.qty), 0);
  }

  const row = [
    new Date(),             // 1 Timestamp
    record.nationalID,      // 2
    record.name,            // 3
    record.region,          // 4
    record.shopName,        // 5
    record.sold,            // 6
    skuFormatted,           // 7 SKUs
    totalCartons,           // 8 TOTAL CARTONS
    record.reason,          // 9 Reason
    record.longitude,       //10
    record.latitude,        //11
    record.selfie           //12
  ];

  sh.appendRow(row);

  return { success: true };
}

// ========= DASHBOARD (MTD) =========
function getDashboardData(nationalID) {
  const sh = SpreadsheetApp.getActive().getSheetByName(VISITS_SHEET);
  const data = sh.getDataRange().getValues();

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  let visitsMTD = 0;
  let soldMTD = 0;
  let cartonsMTD = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(nationalID)) {
      const d = new Date(data[i][0]);

      if (d.getMonth() === month && d.getFullYear() === year) {
        visitsMTD++;

        if (String(data[i][5]) === "Yes") {
          soldMTD++;

          cartonsMTD += Number(data[i][7] || 0); // TOTAL CARTONS COLUMN
        }
      }
    }
  }

  const efficiency = visitsMTD > 0 ? ((soldMTD / visitsMTD) * 100).toFixed(1) : 0;

  return { visitsMTD, soldMTD, cartonsMTD, efficiency };
}

// ========= GET ALL VISITS (for admin) =========
function getAllVisits() {
  const sh = SpreadsheetApp.getActive().getSheetByName(VISITS_SHEET);
  const data = sh.getDataRange().getValues();
  const headers = data[0] || [];

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    rows.push({
      timestamp: r[0],
      nationalID: String(r[1] || ""),
      name: String(r[2] || ""),
      region: String(r[3] || ""),
      shopName: String(r[4] || ""),
      sold: String(r[5] || ""),
      skus: String(r[6] || ""),
      totalCartons: Number(r[7] || 0),
      reason: String(r[8] || ""),
      longitude: r[9] || "",
      latitude: r[10] || "",
      selfie: r[11] || ""
    });
  }
  return rows;
}

// ========= ADMIN SUMMARY (aggregations) =========
// params: { type: "daily"|"weekly"|"monthly", month: 1-12, year: 2025 }
// type controls the time-series grouping; month/year filter which month
function getAdminSummary(params) {
  params = params || {};
  const type = params.type || "monthly";
  const month = Number(params.month); // 1-12 (optional)
  const year = Number(params.year) || (new Date()).getFullYear();

  const visits = getAllVisits(); // array of visit objects
  // We'll filter by month/year if month provided.
  const filtered = visits.filter(v => {
    if (!v.timestamp) return false;
    const d = new Date(v.timestamp);
    if (!month) return d.getFullYear() === year;
    return (d.getMonth() + 1) === month && d.getFullYear() === year;
  });

  // Aggregations by user and by region
  const byUser = {};
  const byRegion = {};

  // time-series containers
  const daily = {}; // dateStr -> {visits, sold, cartons}
  const weekly = {}; // weekKey -> {visits...}
  const monthly = {}; // monthKey -> {visits...}

  filtered.forEach(v => {
    const d = new Date(v.timestamp);
    const dateStr = Utilities.formatDate(d, Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd");
    const weekNum = getWeekNumber(d); // returns like "YYYY-W##"
    const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

    // byUser
    const uid = v.nationalID || "unknown";
    if (!byUser[uid]) byUser[uid] = { nationalID: uid, name: v.name || "", visits: 0, sold: 0, cartons: 0 };
    byUser[uid].visits += 1;
    if (String(v.sold) === "Yes") {
      byUser[uid].sold += 1;
      byUser[uid].cartons += Number(v.totalCartons || 0);
    }

    // byRegion
    const reg = v.region || "Unspecified";
    if (!byRegion[reg]) byRegion[reg] = { region: reg, visits: 0, sold: 0, cartons: 0 };
    byRegion[reg].visits += 1;
    if (String(v.sold) === "Yes") {
      byRegion[reg].sold += 1;
      byRegion[reg].cartons += Number(v.totalCartons || 0);
    }

    // daily
    if (!daily[dateStr]) daily[dateStr] = { date: dateStr, visits: 0, sold: 0, cartons: 0 };
    daily[dateStr].visits += 1;
    if (String(v.sold) === "Yes") {
      daily[dateStr].sold += 1;
      daily[dateStr].cartons += Number(v.totalCartons || 0);
    }

    // weekly
    if (!weekly[weekNum]) weekly[weekNum] = { week: weekNum, visits: 0, sold: 0, cartons: 0 };
    weekly[weekNum].visits += 1;
    if (String(v.sold) === "Yes") {
      weekly[weekNum].sold += 1;
      weekly[weekNum].cartons += Number(v.totalCartons || 0);
    }

    // monthly
    if (!monthly[monthKey]) monthly[monthKey] = { month: monthKey, visits: 0, sold: 0, cartons: 0 };
    monthly[monthKey].visits += 1;
    if (String(v.sold) === "Yes") {
      monthly[monthKey].sold += 1;
      monthly[monthKey].cartons += Number(v.totalCartons || 0);
    }
  });

  // convert objects to arrays and compute efficiency
  const usersArray = Object.values(byUser).map(u => {
    u.efficiency = u.visits > 0 ? Number(((u.sold / u.visits) * 100).toFixed(1)) : 0;
    return u;
  });

  const regionsArray = Object.values(byRegion).map(r => {
    r.efficiency = r.visits > 0 ? Number(((r.sold / r.visits) * 100).toFixed(1)) : 0;
    return r;
  });

  const dailyArray = Object.values(daily).sort((a,b)=> a.date.localeCompare(b.date)).map(x => {
    x.efficiency = x.visits>0 ? Number(((x.sold/x.visits)*100).toFixed(1)) : 0;
    return x;
  });
  const weeklyArray = Object.values(weekly).sort((a,b)=> a.week.localeCompare(b.week)).map(x => {
    x.efficiency = x.visits>0 ? Number(((x.sold/x.visits)*100).toFixed(1)) : 0;
    return x;
  });
  const monthlyArray = Object.values(monthly).sort((a,b)=> a.month.localeCompare(b.month)).map(x => {
    x.efficiency = x.visits>0 ? Number(((x.sold/x.visits)*100).toFixed(1)) : 0;
    return x;
  });

  return {
    users: usersArray,
    regions: regionsArray,
    timeseries: { daily: dailyArray, weekly: weeklyArray, monthly: monthlyArray },
    rawCount: filtered.length
  };
}

function getWeekNumber(d) {
  // returns "YYYY-Www"
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

// ========= WEB APP ENTRY =========
function doPost(e) {
  const req = JSON.parse(e.postData.contents);

  switch (req.action) {
    case "login":
      return ContentService.createTextOutput(JSON.stringify(loginUser(req.nationalID, req.password)));
    case "saveVisit":
      return ContentService.createTextOutput(JSON.stringify(saveVisit(req.record)));
    case "dashboard":
      return ContentService.createTextOutput(JSON.stringify(getDashboardData(req.nationalID)));
    case "getAllVisits":
      return ContentService.createTextOutput(JSON.stringify(getAllVisits()));
    case "adminSummary":
      return ContentService.createTextOutput(JSON.stringify(getAdminSummary(req.params)));
    default:
      return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }));
  }
}