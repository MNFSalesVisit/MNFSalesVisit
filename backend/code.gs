// =======================
// CONFIG
// =======================
const USERS_SHEET = "Users";
const UPLIFT_SHEET = "Uplift";
const TARGETS_SHEET = "Targets";

// Folder name in Drive to store uploaded receipts
const RECEIPT_FOLDER_NAME = 'SprintApp_Uplift_Receipts';

/**
 * Save a data URL image to Drive and return a shareable URL.
 * Returns null on failure.
 */
function saveDataUrlToDrive(dataUrl, nationalID) {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    var matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
    if (!matches) return null;
    var contentType = matches[1];
    var base64Data = matches[2];

    var bytes = Utilities.base64Decode(base64Data);
    var extension = 'jpg';
    if (contentType.indexOf('/') > -1) {
      extension = contentType.split('/')[1];
      extension = extension.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    }

    var filename = 'receipt_' + (nationalID || 'unknown') + '_' + new Date().getTime() + '.' + extension;
    var blob = Utilities.newBlob(bytes, contentType, filename);

    // Ensure folder exists
    var folders = DriveApp.getFoldersByName(RECEIPT_FOLDER_NAME);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(RECEIPT_FOLDER_NAME);

    var file = folder.createFile(blob);
    // Make it viewable with link
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      // If setting sharing fails (insufficient permissions), ignore and continue — return URL which may require auth
      Logger.log('setSharing failed: ' + e.message);
    }

    var url = (typeof file.getUrl === 'function') ? file.getUrl() : null;
    // If getUrl() isn't available or returned null, construct a usable viewer URL using the file ID
    if ((!url || url === '') && file.getId) {
      try {
        url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
      } catch (e) {
        url = null;
      }
    }

    return url || (file.getId ? ('https://drive.google.com/uc?export=view&id=' + file.getId()) : null);
  } catch (err) {
    Logger.log('saveDataUrlToDrive error: ' + err.message);
    return null;
  }
}

// ========= HELPER: GET MONTH SHEET NAME =========
function getMonthSheetName(date) {
  // Returns format like "Nov-2025", "Dec-2025"
  const d = date || new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "GMT", "MMM-yyyy");
}

// ========= HELPER: GET ALL VISIT SHEET NAMES =========
function getAllVisitSheetNames() {
  const ss = SpreadsheetApp.getActive();
  const allSheets = ss.getSheets();
  const visitSheets = [];
  
  // Pattern to match: "MMM-yyyy" (e.g., "Nov-2025", "Dec-2025")
  const monthPattern = /^[A-Z][a-z]{2}-\d{4}$/;
  
  allSheets.forEach(sheet => {
    const name = sheet.getName();
    if (monthPattern.test(name)) {
      visitSheets.push(name);
    }
  });
  
  return visitSheets;
}

// ========= HELPER: PARSE SKU STRING =========
function parseSKUString(skuString) {
  // Parses "Chicken:5 | Beef:3 | Pork:2" into { Chicken: 5, Beef: 3, Pork: 2 }
  const skuObject = {};
  
  if (!skuString) return skuObject;
  
  const skuPairs = String(skuString).split("|").map(s => s.trim());
  
  skuPairs.forEach(pair => {
    const parts = pair.split(":");
    if (parts.length === 2) {
      const skuName = parts[0].trim();
      const qty = Number(parts[1].trim()) || 0;
      if (skuName && qty > 0) {
        skuObject[skuName] = (skuObject[skuName] || 0) + qty;
      }
    }
  });
  
  return skuObject;
}

// ========= GET STOCK BALANCE BY SKU =========
function getStockBalanceBySKU(nationalID) {
  const ss = SpreadsheetApp.getActive();
  
  // Initialize SKU balances object
  const skuBalances = {};
  
  // 1. Calculate total uplifted per SKU (only Approved uplifts)
  const upliftSheet = ensureUpliftSheet();
  const upliftData = upliftSheet.getDataRange().getValues();
  
  for (let i = 1; i < upliftData.length; i++) {
    if (String(upliftData[i][1]) === String(nationalID)) {
      const status = String(upliftData[i][10] || "");
      if (status === "Approved") {
        const skuString = String(upliftData[i][5] || "");
        const parsedSKUs = parseSKUString(skuString);
        
        // Add uplifted quantities
        Object.keys(parsedSKUs).forEach(skuName => {
          skuBalances[skuName] = (skuBalances[skuName] || 0) + parsedSKUs[skuName];
        });
      }
    }
  }
  
  // 2. Subtract sold quantities from ALL monthly sheets
  const allVisitSheetNames = getAllVisitSheetNames();
  
  allVisitSheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(nationalID) && String(data[i][5]) === "Yes") {
          const skuString = String(data[i][6] || "");
          const parsedSKUs = parseSKUString(skuString);
          
          // Subtract sold quantities
          Object.keys(parsedSKUs).forEach(skuName => {
            skuBalances[skuName] = (skuBalances[skuName] || 0) - parsedSKUs[skuName];
          });
        }
      }
    }
  });
  
  // 3. Calculate total balance
  let totalBalance = 0;
  Object.keys(skuBalances).forEach(skuName => {
    totalBalance += skuBalances[skuName];
  });
  
  return {
    skuBalances: skuBalances,
    totalBalance: totalBalance
  };
}

// ========= GET ALL USERS STOCK BALANCE (for admin) =========
function getAllUsersStockBalance() {
  const ss = SpreadsheetApp.getActive();
  const usersSheet = ss.getSheetByName(USERS_SHEET);
  
  if (!usersSheet) {
    return [];
  }
  
  const usersData = usersSheet.getDataRange().getValues();
  const results = [];
  
  // Get stock balance for each user
  for (let i = 1; i < usersData.length; i++) {
    const nationalID = String(usersData[i][0]).trim();
    const name = String(usersData[i][2] || "").trim();
    const role = String(usersData[i][3] || "").trim().toLowerCase();
    
    // Only get stock for non-admin users
    if (role !== "admin") {
      const stockInfo = getStockBalanceBySKU(nationalID);
      
      results.push({
        nationalID: nationalID,
        name: name,
        skuBalances: stockInfo.skuBalances,
        totalBalance: stockInfo.totalBalance
      });
    }
  }
  
  return results;
}

// ========= AUTO-CREATE MONTHLY VISIT SHEET =========
function ensureMonthlyVisitSheet(date) {
  const ss = SpreadsheetApp.getActive();
  const sheetName = getMonthSheetName(date);
  let visitSheet = ss.getSheetByName(sheetName);
  
  if (!visitSheet) {
    visitSheet = ss.insertSheet(sheetName);
    
    // Set up headers (same as original Visits sheet)
    const headers = [
      "Timestamp",
      "National ID",
      "Name",
      "Region",
      "Shop Name",
      "Sold",
      "SKUs",
      "Total Cartons",
      "Reason",
      "Longitude",
      "Latitude",
      "Selfie"
    ];
    
    visitSheet.appendRow(headers);
    
    // Format header row
    const headerRange = visitSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    Logger.log(`Monthly visit sheet created: ${sheetName}`);
  }
  
  return visitSheet;
}

// ========= AUTO-CREATE UPLIFT SHEET =========
function ensureUpliftSheet() {
  const ss = SpreadsheetApp.getActive();
  let upliftSheet = ss.getSheetByName(UPLIFT_SHEET);
  
  if (!upliftSheet) {
    upliftSheet = ss.insertSheet(UPLIFT_SHEET);
    
    // Set up headers
    const headers = [
      "Timestamp",
      "National ID",
      "Name",
      "Region",
      "Shop Name",
      "SKUs",
      "Total Cartons",
      "Receipt Photo",
      "Longitude",
      "Latitude",
      "Status",
      "Rejection Reason",
      "Approved By",
      "Approved Date"
    ];
    
    upliftSheet.appendRow(headers);
    
    // Format header row
    const headerRange = upliftSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    Logger.log("Uplift sheet created successfully");
  }
  
  return upliftSheet;
}

// ========= AUTO-CREATE UPLIFT LOGS SHEET =========
function ensureUpliftLogsSheet() {
  const ss = SpreadsheetApp.getActive();
  const name = 'UpliftLogs';
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(['Timestamp', 'NationalID', 'photosCount', 'firstIsDataUrl', 'firstLength', 'savedUrl_or_receiptField_trunc', 'error']);
  }
  return sh;
}

// ========= AUTO-CREATE TARGETS SHEET =========
function ensureTargetsSheet() {
  const ss = SpreadsheetApp.getActive();
  let targetsSheet = ss.getSheetByName(TARGETS_SHEET);
  
  if (!targetsSheet) {
    targetsSheet = ss.insertSheet(TARGETS_SHEET);
    
    // Set up headers
    const headers = [
      "National ID",
      "Name",
      "Daily Target",
      "Weekly Target",
      "Monthly Target"
    ];
    
    targetsSheet.appendRow(headers);
    
    // Format header row
    const headerRange = targetsSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    Logger.log("Targets sheet created successfully");
  }
  
  return targetsSheet;
}

// ========= LOGIN =========
function loginUser(nationalID, password) {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(USERS_SHEET);
    
    if (!sh) {
      return { success: false, message: "Users sheet not found" };
    }
    
    const data = sh.getDataRange().getValues();
    
    // Log for debugging (remove in production)
    Logger.log(`Login attempt - ID: ${nationalID}, Total users: ${data.length - 1}`);

    for (let i = 1; i < data.length; i++) {
      const storedID = String(data[i][0]).trim();
      const storedPass = String(data[i][1]).trim();
      const inputID = String(nationalID).trim();
      const inputPass = String(password).trim();
      
      // Log each comparison (remove in production)
      Logger.log(`Comparing: "${inputID}" === "${storedID}" && "${inputPass}" === "${storedPass}"`);
      
      if (storedID === inputID && storedPass === inputPass) {
        const role = String(data[i][3] || "").trim().toLowerCase();
        Logger.log(`Login successful for ${data[i][2]} with role: ${role}`);
        
        return {
          success: true,
          nationalID: storedID,
          name: String(data[i][2] || "").trim(),
          role: role
        };
      }
    }
    
    Logger.log("No matching credentials found");
    return { success: false, message: "Invalid credentials" };
    
  } catch (error) {
    Logger.log(`Login error: ${error.message}`);
    return { success: false, message: "Login error: " + error.message };
  }
}

// ========= SAVE VISIT (MULTI SKU SUPPORT) =========
function saveVisit(record) {
  // VALIDATION: Check stock balance if this is a sale
  if (String(record.sold) === "Yes" && record.skus && record.skus.length > 0) {
    const stockInfo = getStockBalanceBySKU(record.nationalID);
    const currentBalances = stockInfo.skuBalances;
    
    // Check each SKU being sold
    const insufficientSKUs = [];
    
    record.skus.forEach(sku => {
      const skuName = String(sku.name).trim();
      const qtyToSell = Number(sku.qty) || 0;
      const currentBalance = currentBalances[skuName] || 0;
      
      if (qtyToSell > currentBalance) {
        insufficientSKUs.push({
          sku: skuName,
          requested: qtyToSell,
          available: currentBalance
        });
      }
    });
    
    // If any SKU has insufficient stock, reject the sale
    if (insufficientSKUs.length > 0) {
      const errorDetails = insufficientSKUs
        .map(item => `${item.sku}: requested ${item.requested}, available ${item.available}`)
        .join("; ");
      
      return {
        success: false,
        message: `Insufficient stock. ${errorDetails}`,
        insufficientSKUs: insufficientSKUs
      };
    }
  }
  
  // Get current month's sheet (auto-creates if doesn't exist)
  const now = new Date();
  const sh = ensureMonthlyVisitSheet(now);

  // Format SKU structure into readable text
  var receiptField = "";
  var savedUrls = [];
  var receiptError = '';
  var photos = [];
  try {
    if (record.receiptPhoto) {
      if (Object.prototype.toString.call(record.receiptPhoto) === '[object Array]') {
        photos = record.receiptPhoto;
      } else if (typeof record.receiptPhoto === 'string') {
        try {
          var parsed = JSON.parse(record.receiptPhoto);
          if (Object.prototype.toString.call(parsed) === '[object Array]') {
            photos = parsed;
          } else {
            photos = [record.receiptPhoto];
          }
        } catch (e) {
          photos = [record.receiptPhoto];
        }
      }
    }

    for (var p = 0; p < photos.length; p++) {
      var img = photos[p];
      if (typeof img === 'string' && img.indexOf('data:') === 0) {
        var url = saveDataUrlToDrive(img, record.nationalID);
        if (url) savedUrls.push(url);
      } else if (typeof img === 'string' && img.indexOf('http') === 0) {
        savedUrls.push(img);
      }
      if (savedUrls.length >= 1) break;
    }

    if (savedUrls.length === 1) {
      receiptField = savedUrls[0];
    } else if (savedUrls.length > 1) {
      receiptField = JSON.stringify(savedUrls);
    } else {
      receiptField = (typeof record.receiptPhoto === 'string') ? record.receiptPhoto : '';
    }
  } catch (ex) {
    Logger.log('Receipt processing error: ' + ex.message);
    receiptError = ex.message || String(ex);
    receiptField = (typeof record.receiptPhoto === 'string') ? record.receiptPhoto : '';
  }

  // Append a small debug entry to UpliftLogs so we can inspect why receipts are blank
  try {
    var logSh = ensureUpliftLogsSheet();
    var photosCount = Array.isArray(photos) ? photos.length : (photos ? 1 : 0);
    var firstIsDataUrl = (photosCount > 0 && typeof photos[0] === 'string' && photos[0].indexOf('data:') === 0) ? 'yes' : 'no';
    var firstLength = (photosCount > 0 && typeof photos[0] === 'string') ? String(photos[0].length) : '';
    var truncated = receiptField ? (String(receiptField).slice(0, 500)) : '';
    logSh.appendRow([new Date(), record.nationalID || '', photosCount, firstIsDataUrl, firstLength, truncated, receiptError]);
  } catch (logErr) {
    Logger.log('Failed to write UpliftLogs entry: ' + (logErr && logErr.message ? logErr.message : String(logErr)));
  }
      .join(" | ");

    totalCartons = record.skus.reduce((sum, s) => sum + Number(s.qty), 0);
  }
  // Process receipt photo(s): if the frontend sent data-URLs, save to Drive and store link(s)
  var receiptField = "";
  try {
    var photos = [];
    if (record.receiptPhoto) {
      if (Object.prototype.toString.call(record.receiptPhoto) === '[object Array]') {
        photos = record.receiptPhoto;
      } else if (typeof record.receiptPhoto === 'string') {
        // Could be a single dataURL or a JSON array encoded as string
        try {
          var parsed = JSON.parse(record.receiptPhoto);
          if (Object.prototype.toString.call(parsed) === '[object Array]') {
            photos = parsed;
          } else {
            photos = [record.receiptPhoto];
          }
        } catch (e) {
          photos = [record.receiptPhoto];
        }
      }
    }

    var savedUrls = [];
    for (var p = 0; p < photos.length; p++) {
      var img = photos[p];
      if (typeof img === 'string' && img.indexOf('data:') === 0) {
        var url = saveDataUrlToDrive(img, record.nationalID);
        if (url) savedUrls.push(url);
      } else if (typeof img === 'string' && img.indexOf('http') === 0) {
        // Already a URL
        savedUrls.push(img);
      }
      // Only keep first image for now (frontend expects single file)
      if (savedUrls.length >= 1) break;
    }

    if (savedUrls.length === 1) {
      receiptField = savedUrls[0];
    } else if (savedUrls.length > 1) {
      receiptField = JSON.stringify(savedUrls);
    } else {
      // Fallback to storing raw value (may be empty or non-data URL)
      receiptField = (typeof record.receiptPhoto === 'string') ? record.receiptPhoto : '';
    }
  } catch (ex) {
    Logger.log('Receipt processing error: ' + ex.message);
    receiptField = (typeof record.receiptPhoto === 'string') ? record.receiptPhoto : '';
  }

  const row = [
    new Date(),             // 1 Timestamp
    record.nationalID,      // 2
    record.name,            // 3
    record.region,          // 4
    record.shopName,        // 5
    skuFormatted,           // 6 SKUs
    totalCartons,           // 7 TOTAL CARTONS
    receiptField,           // 8 Receipt Photo (link or raw)
    record.longitude,       // 9
    record.latitude,        //10
    "Pending",              //11 Status
    "",                     //12 Rejection Reason
    "",                     //13 Approved By
    ""                      //14 Approved Date
  ];

  sh.appendRow(row);

  return { success: true };
}

// ========= DASHBOARD (MTD) + STOCK BALANCE =========
function getDashboardData(nationalID) {
  const ss = SpreadsheetApp.getActive();
  const now = new Date();
  const currentMonthSheetName = getMonthSheetName(now);
  const currentMonthSheet = ss.getSheetByName(currentMonthSheetName);

  let visitsMTD = 0;
  let soldMTD = 0;
  let cartonsMTD = 0;

  // Calculate MTD stats from current month's sheet
  if (currentMonthSheet) {
    const visitsData = currentMonthSheet.getDataRange().getValues();
    
    for (let i = 1; i < visitsData.length; i++) {
      if (String(visitsData[i][1]) === String(nationalID)) {
        visitsMTD++;

        if (String(visitsData[i][5]) === "Yes") {
          soldMTD++;
          cartonsMTD += Number(visitsData[i][7] || 0); // TOTAL CARTONS COLUMN
        }
      }
    }
  }

  // Calculate all-time sold (for stock balance) from ALL monthly sheets
  let totalSoldAllTime = 0;
  const allVisitSheetNames = getAllVisitSheetNames();
  
  allVisitSheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][1]) === String(nationalID) && String(data[i][5]) === "Yes") {
          totalSoldAllTime += Number(data[i][7] || 0);
        }
      }
    }
  });

  // Calculate all-time uplifted (only Approved uplifts)
  let totalUpliftedAllTime = 0;
  const upliftSheet = ensureUpliftSheet();
  const upliftData = upliftSheet.getDataRange().getValues();
  
  for (let i = 1; i < upliftData.length; i++) {
    if (String(upliftData[i][1]) === String(nationalID)) {
      const status = String(upliftData[i][10] || ""); // Status column
      if (status === "Approved") {
        totalUpliftedAllTime += Number(upliftData[i][6] || 0); // Total Cartons column
      }
    }
  }

  // Calculate stock balance (SKU-level)
  const stockInfo = getStockBalanceBySKU(nationalID);

  const efficiency = visitsMTD > 0 ? ((soldMTD / visitsMTD) * 100).toFixed(1) : 0;

  return { 
    visitsMTD, 
    soldMTD, 
    cartonsMTD, 
    efficiency,
    stockBalance: stockInfo.totalBalance,
    stockBalanceBySKU: stockInfo.skuBalances
  };
}

// ========= GET ALL VISITS (for admin) =========
function getAllVisits() {
  const ss = SpreadsheetApp.getActive();
  const allVisitSheetNames = getAllVisitSheetNames();
  const rows = [];

  // Read from all monthly visit sheets
  allVisitSheetNames.forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (sh) {
      const data = sh.getDataRange().getValues();
      
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
    }
  });

  // Sort by timestamp descending (newest first)
  rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return rows;
}

// ========= GET USER UPLIFT STATUS (MTD for user dashboard) =========
function getUserUpliftStatus(nationalID) {
  const sh = ensureUpliftSheet();
  const data = sh.getDataRange().getValues();
  
  if (data.length <= 1) {
    return []; // Only headers or empty
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const upliftNationalID = String(r[1] || "");
    
    if (upliftNationalID === String(nationalID)) {
      const d = new Date(r[0]);
      
      // Filter by current month
      if (d.getMonth() === month && d.getFullYear() === year) {
        rows.push({
          timestamp: r[0],
          skus: String(r[5] || ""),
          totalCartons: Number(r[6] || 0),
          status: String(r[10] || "Pending"),
          rejectionReason: String(r[11] || "")
        });
      }
    }
  }
  
  // Sort by timestamp descending (newest first) and limit to 10
  rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return rows.slice(0, 10);
}

// ========= GET PENDING UPLIFTS (for admin verification) =========
function getPendingUplifts() {
  const sh = ensureUpliftSheet();
  const data = sh.getDataRange().getValues();
  
  if (data.length <= 1) {
    return []; // Only headers or empty
  }

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const status = String(r[10] || "Pending");
    
    if (status === "Pending") {
      rows.push({
        rowIndex: i + 1,
        timestamp: r[0],
        nationalID: String(r[1] || ""),
        name: String(r[2] || ""),
        region: String(r[3] || ""),
        shopName: String(r[4] || ""),
        skus: String(r[5] || ""),
        totalCartons: Number(r[6] || 0),
        receiptPhoto: r[7] || "",
        longitude: r[8] || "",
        latitude: r[9] || ""
      });
    }
  }
  return rows;
}

// ========= GET ALL UPLIFT VISITS (for admin) =========
function getAllUpliftVisits() {
  const sh = ensureUpliftSheet();
  const data = sh.getDataRange().getValues();
  
  if (data.length <= 1) {
    return []; // Only headers or empty
  }

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    rows.push({
      rowIndex: i + 1,
      timestamp: r[0],
      nationalID: String(r[1] || ""),
      name: String(r[2] || ""),
      region: String(r[3] || ""),
      shopName: String(r[4] || ""),
      skus: String(r[5] || ""),
      totalCartons: Number(r[6] || 0),
      receiptPhoto: r[7] || "",
      longitude: r[8] || "",
      latitude: r[9] || "",
      status: String(r[10] || "Pending"),
      rejectionReason: String(r[11] || ""),
      approvedBy: String(r[12] || ""),
      approvedDate: r[13] || ""
    });
  }
  return rows;
}

// ========= APPROVE UPLIFT =========
function approveUplift(rowIndex, approvedBy) {
  const sh = ensureUpliftSheet();
  const row = Number(rowIndex);
  
  if (row < 2) {
    return { success: false, message: "Invalid row index" };
  }
  
  sh.getRange(row, 11).setValue("Approved"); // Status column
  sh.getRange(row, 13).setValue(approvedBy); // Approved By
  sh.getRange(row, 14).setValue(new Date()); // Approved Date
  
  return { success: true };
}

// ========= REJECT UPLIFT =========
function rejectUplift(rowIndex, reason, rejectedBy) {
  const sh = ensureUpliftSheet();
  const row = Number(rowIndex);
  
  if (row < 2) {
    return { success: false, message: "Invalid row index" };
  }
  
  sh.getRange(row, 11).setValue("Rejected"); // Status column
  sh.getRange(row, 12).setValue(reason); // Rejection Reason
  sh.getRange(row, 13).setValue(rejectedBy); // Rejected By (using same column)
  sh.getRange(row, 14).setValue(new Date()); // Rejection Date
  
  return { success: true };
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

// ========= SKU ANALYSIS (by selected period) =========
function getSKUAnalysis(params) {
  params = params || {};
  const month = Number(params.month); // 1-12 (optional)
  const year = Number(params.year) || (new Date()).getFullYear();

  const visits = getAllVisits();
  
  // Filter by month/year
  const filtered = visits.filter(v => {
    if (!v.timestamp) return false;
    const d = new Date(v.timestamp);
    if (!month) return d.getFullYear() === year;
    return (d.getMonth() + 1) === month && d.getFullYear() === year;
  });

  // Parse SKUs and aggregate
  const skuStats = {};
  
  filtered.forEach(v => {
    if (String(v.sold) !== "Yes") return; // Only count actual sales
    
    const skuString = String(v.skus || "");
    if (!skuString) return;
    
    // Parse "SKU1:5 | SKU2:10 | SKU3:3" format
    const skuPairs = skuString.split("|").map(s => s.trim());
    
    skuPairs.forEach(pair => {
      const parts = pair.split(":");
      if (parts.length !== 2) return;
      
      const skuName = parts[0].trim();
      const qty = Number(parts[1].trim()) || 0;
      
      if (!skuStats[skuName]) {
        skuStats[skuName] = {
          sku: skuName,
          totalCartons: 0,
          totalVisits: 0,
          salespeople: new Set()
        };
      }
      
      skuStats[skuName].totalCartons += qty;
      skuStats[skuName].totalVisits += 1;
      skuStats[skuName].salespeople.add(v.name || v.nationalID);
    });
  });

  // Convert to array and add salesperson count
  const skuArray = Object.values(skuStats).map(s => ({
    sku: s.sku,
    totalCartons: s.totalCartons,
    totalVisits: s.totalVisits,
    salespeopleCount: s.salespeople.size
  })).sort((a, b) => b.totalCartons - a.totalCartons);

  return skuArray;
}

// ========= SET USER TARGETS =========
function setUserTargets(nationalID, name, dailyTarget, weeklyTarget, monthlyTarget) {
  const sh = ensureTargetsSheet();
  const data = sh.getDataRange().getValues();
  
  // Check if user already has targets
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nationalID)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing targets
    sh.getRange(rowIndex, 3).setValue(Number(dailyTarget));
    sh.getRange(rowIndex, 4).setValue(Number(weeklyTarget));
    sh.getRange(rowIndex, 5).setValue(Number(monthlyTarget));
  } else {
    // Add new targets
    sh.appendRow([
      String(nationalID),
      String(name),
      Number(dailyTarget),
      Number(weeklyTarget),
      Number(monthlyTarget)
    ]);
  }
  
  return { success: true };
}

// ========= GET USER TARGETS =========
function getUserTargets(nationalID) {
  const sh = ensureTargetsSheet();
  const data = sh.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nationalID)) {
      return {
        nationalID: String(data[i][0]),
        name: String(data[i][1]),
        dailyTarget: Number(data[i][2]) || 0,
        weeklyTarget: Number(data[i][3]) || 0,
        monthlyTarget: Number(data[i][4]) || 0
      };
    }
  }
  
  // Return zeros if no targets set
  return {
    nationalID: String(nationalID),
    name: "",
    dailyTarget: 0,
    weeklyTarget: 0,
    monthlyTarget: 0
  };
}

// ========= GET ALL TARGETS (for admin) =========
function getAllTargets() {
  const sh = ensureTargetsSheet();
  const data = sh.getDataRange().getValues();
  
  const targets = [];
  for (let i = 1; i < data.length; i++) {
    targets.push({
      nationalID: String(data[i][0]),
      name: String(data[i][1]),
      dailyTarget: Number(data[i][2]) || 0,
      weeklyTarget: Number(data[i][3]) || 0,
      monthlyTarget: Number(data[i][4]) || 0
    });
  }
  
  return targets;
}

// ========= GET USER PROGRESS (cartons sold vs targets) =========
function getUserProgress(nationalID) {
  const ss = SpreadsheetApp.getActive();
  const now = new Date();
  const currentMonthSheetName = getMonthSheetName(now);
  const visitsSheet = ss.getSheetByName(currentMonthSheetName);
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calculate start of week (Monday)
  const dayOfWeek = today.getDay();
  const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + daysToMonday);
  
  // Calculate start of month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  let dailyCartons = 0;
  let weeklyCartons = 0;
  let monthlyCartons = 0;
  
  // Read from current month's sheet
  if (visitsSheet) {
    const visitsData = visitsSheet.getDataRange().getValues();
    
    for (let i = 1; i < visitsData.length; i++) {
      if (String(visitsData[i][1]) === String(nationalID) && String(visitsData[i][5]) === "Yes") {
        const visitDate = new Date(visitsData[i][0]);
        const cartons = Number(visitsData[i][7] || 0);
        
        // Daily
        if (visitDate >= today && visitDate < new Date(today.getTime() + 86400000)) {
          dailyCartons += cartons;
        }
        
        // Weekly
        if (visitDate >= startOfWeek) {
          weeklyCartons += cartons;
        }
        
        // Monthly
        if (visitDate >= startOfMonth) {
          monthlyCartons += cartons;
        }
      }
    }
  }
  
  // Get targets
  const targets = getUserTargets(nationalID);
  
  return {
    daily: {
      current: dailyCartons,
      target: targets.dailyTarget,
      percentage: targets.dailyTarget > 0 ? Math.min(100, Math.round((dailyCartons / targets.dailyTarget) * 100)) : 0
    },
    weekly: {
      current: weeklyCartons,
      target: targets.weeklyTarget,
      percentage: targets.weeklyTarget > 0 ? Math.min(100, Math.round((weeklyCartons / targets.weeklyTarget) * 100)) : 0
    },
    monthly: {
      current: monthlyCartons,
      target: targets.monthlyTarget,
      percentage: targets.monthlyTarget > 0 ? Math.min(100, Math.round((monthlyCartons / targets.monthlyTarget) * 100)) : 0
    }
  };
}

// ========= WEB APP ENTRY =========
function doPost(e) {
  const req = JSON.parse(e.postData.contents);

  switch (req.action) {
    case "login":
      return ContentService.createTextOutput(JSON.stringify(loginUser(req.nationalID, req.password)));
    case "saveVisit":
      return ContentService.createTextOutput(JSON.stringify(saveVisit(req.record)));
    case "saveUpliftVisit":
      return ContentService.createTextOutput(JSON.stringify(saveUpliftVisit(req.record)));
    case "dashboard":
      return ContentService.createTextOutput(JSON.stringify(getDashboardData(req.nationalID)));
    case "getAllVisits":
      return ContentService.createTextOutput(JSON.stringify(getAllVisits()));
    case "getAllUpliftVisits":
      return ContentService.createTextOutput(JSON.stringify(getAllUpliftVisits()));
    case "adminSummary":
      return ContentService.createTextOutput(JSON.stringify(getAdminSummary(req.params)));
    case "getPendingUplifts":
      return ContentService.createTextOutput(JSON.stringify(getPendingUplifts()));
    case "approveUplift":
      return ContentService.createTextOutput(JSON.stringify(approveUplift(req.rowIndex, req.approvedBy)));
    case "rejectUplift":
      return ContentService.createTextOutput(JSON.stringify(rejectUplift(req.rowIndex, req.reason, req.rejectedBy)));
    case "getUserUpliftStatus":
      return ContentService.createTextOutput(JSON.stringify(getUserUpliftStatus(req.nationalID)));
    case "getSKUAnalysis":
      return ContentService.createTextOutput(JSON.stringify(getSKUAnalysis(req.params)));
    case "setUserTargets":
      return ContentService.createTextOutput(JSON.stringify(setUserTargets(req.nationalID, req.name, req.dailyTarget, req.weeklyTarget, req.monthlyTarget)));
    case "getUserTargets":
      return ContentService.createTextOutput(JSON.stringify(getUserTargets(req.nationalID)));
    case "getAllTargets":
      return ContentService.createTextOutput(JSON.stringify(getAllTargets()));
    case "getUserProgress":
      return ContentService.createTextOutput(JSON.stringify(getUserProgress(req.nationalID)));
    case "getStockBalanceBySKU":
      return ContentService.createTextOutput(JSON.stringify(getStockBalanceBySKU(req.nationalID)));
    case "getAllUsersStockBalance":
      return ContentService.createTextOutput(JSON.stringify(getAllUsersStockBalance()));
    default:
      return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }));
  }
}

/**
 * Migrate existing data-URL images stored in the Uplift sheet into Drive links.
 * Run this once (manually) if you have old rows where the Receipt Photo column contains a data URL.
 */
function migrateExistingReceipts() {
  var sh = ensureUpliftSheet();
  var dataRange = sh.getDataRange();
  var data = dataRange.getValues();

  for (var i = 1; i < data.length; i++) {
    var cellVal = data[i][7]; // Receipt Photo column (index 7, zero-based)
    if (!cellVal || typeof cellVal !== 'string') continue;

    try {
      if (cellVal.indexOf('data:') === 0) {
        // Old data-URL image — save to Drive
        var url = saveDataUrlToDrive(cellVal, data[i][1]);
        if (url) {
          sh.getRange(i + 1, 8).setValue(url);
        }
      } else if (cellVal.indexOf('http') === 0) {
        // Already a URL — nothing to do
        continue;
      } else {
        // Possibly a raw Drive file ID (saved earlier). Convert to a usable viewer URL if it looks like an ID
        var trimmed = cellVal.trim();
        if (/^[A-Za-z0-9_-]{10,100}$/.test(trimmed)) {
          var constructed = 'https://drive.google.com/uc?export=view&id=' + trimmed;
          sh.getRange(i + 1, 8).setValue(constructed);
        }
      }
    } catch (e) {
      Logger.log('migrateExistingReceipts error on row ' + (i+1) + ': ' + e.message);
    }
  }

  return { success: true };
}