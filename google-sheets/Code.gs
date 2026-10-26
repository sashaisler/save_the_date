/**
 * Bound to your private response spreadsheet via Extensions > Apps Script.
 * Already configured for Sasha and Eytan’s response spreadsheet and website.
 * Paste this whole file into Extensions > Apps Script, save, and deploy as a web app.
 * Script Properties are optional overrides; no properties need to be added.
 * Execute as: Me. Access: Anyone. Keep the spreadsheet itself private.
 */
function doPost(e) {
  var properties = PropertiesService.getScriptProperties();
  var origin = properties.getProperty('SITE_ORIGIN') || 'https://june-twenty-save-the-date-2027.islerd.chatgpt.site';
  if (!origin || !/^https:\/\/[^/]+$/.test(origin)) {
    return HtmlService.createHtmlOutput('Please configure SITE_ORIGIN in Script Properties.');
  }
  var data = (e && e.parameter) || {};
  var requestId = String(data.requestId || '').slice(0, 50);
  var ok = false;
  var lock;
  try {
    if (!e || Number(e.contentLength) > 12000 || data.website) throw new Error('Invalid request');
    if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid request ID');
    var limits = { firstName: 100, lastName: 100, street: 250, unit: 100, city: 100, region: 100, postalCode: 30, country: 100, partnerName: 200 };
    var clean = {};
    Object.keys(limits).forEach(function(key) {
      var value = String(data[key] || '').trim();
      if (value.length > limits[key]) throw new Error('Field too long');
      clean[key] = value;
    });
    ['firstName', 'lastName', 'street', 'city', 'region', 'postalCode', 'country'].forEach(function(key) {
      if (!clean[key]) throw new Error('Missing required field');
    });
    if (data.hasPartner === 'yes' && !clean.partnerName) throw new Error('Missing partner name');
    if (data.hasPartner !== 'yes') clean.partnerName = '';
    if (['yes', 'maybe', 'no'].indexOf(data.attendance) === -1) throw new Error('Invalid attendance');
    var spreadsheetId = properties.getProperty('SPREADSHEET_ID') || '1vFlW31srW1Y-NUID5nPAWbvNnkK2LUttqqhWI_r7h5g';
    if (!spreadsheetId) throw new Error('Missing spreadsheet');
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName('Guest responses') || spreadsheet.insertSheet('Guest responses');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Received', 'Response ID', 'First name', 'Last name', 'Partner name', 'Street', 'Apartment / suite', 'City', 'State / region', 'ZIP / postal code', 'Country', 'Likely attendance']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#ead0d0');
    }
    var duplicate = sheet.getLastRow() > 1 && sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext();
    if (!duplicate) {
      var safe = function(value) { return /^[=+\-@\t\r\n]/.test(value) ? "'" + value : value; };
      var attendance = { yes: 'Wouldn’t miss it', maybe: 'Hope so', no: 'Celebrating from afar' };
      sheet.appendRow([new Date(), requestId, safe(clean.firstName), safe(clean.lastName), safe(clean.partnerName), safe(clean.street), safe(clean.unit), safe(clean.city), safe(clean.region), safe(clean.postalCode), safe(clean.country), attendance[data.attendance]]);
    }
    ok = true;
  } catch (error) {
    // Never expose guest details or internal error messages to the browser.
    ok = false;
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
  // Native cross-origin form POST + a verified acknowledgement avoids opaque no-cors "success".
  var payload = JSON.stringify({ type: 'wedding-response', requestId: requestId, ok: ok }).replace(/</g, '\\u003c');
  var destination = JSON.stringify(origin).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage(' + payload + ',' + destination + ');</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet() {
  return HtmlService.createHtmlOutput('Wedding response service. Submit your details through the wedding website.');
}
