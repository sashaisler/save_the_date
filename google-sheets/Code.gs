/**
 * Bound to your private response spreadsheet via Extensions > Apps Script.
 * Already configured for Sasha and Eytan’s response spreadsheet and website.
 * Paste this whole file into Extensions > Apps Script, save, and deploy as a web app.
 * Script Properties are optional overrides; no properties need to be added.
 * Execute as: Me. Access: Anyone. Keep the spreadsheet itself private.
 */
function doPost(e) {
  var properties = PropertiesService.getScriptProperties();
  var primaryOrigin = properties.getProperty('SITE_ORIGIN') || 'https://june-twenty-save-the-date-2027.islerd.chatgpt.site';
  var data = (e && e.parameter) || {};
  var origin = String(data.siteOrigin || primaryOrigin);
  var allowedOrigins = [primaryOrigin, 'https://june-twenty-save-the-date-2027.islerd.chatgpt.site', 'https://sashaisler.github.io'];
  if (!/^https:\/\/[^/]+$/.test(origin) || allowedOrigins.indexOf(origin) === -1) {
    return HtmlService.createHtmlOutput('This website is not configured to receive submission confirmations.');
  }
  var requestId = String(data.requestId || '').slice(0, 50);
  var ok = false;
  var lock;
  try {
    if (!e || Number(e.contentLength) > 12000 || data.website) throw new Error('Invalid request');
    if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid request ID');
    var limits = { firstName: 100, lastName: 100, street: 250, unit: 100, city: 100, region: 100, postalCode: 30, country: 100, partnerName: 200, title: 100, titleOther: 100, email: 254 };
    var clean = {};
    Object.keys(limits).forEach(function(key) {
      var value = String(data[key] || '').trim();
      if (value.length > limits[key]) throw new Error('Field too long');
      clean[key] = value;
    });
    ['firstName', 'lastName', 'street', 'city', 'region', 'postalCode', 'country', 'email'].forEach(function(key) {
      if (!clean[key]) throw new Error('Missing required field');
    });
    if (!/^[^\s@]+@[^\s@]+$/.test(clean.email)) throw new Error('Invalid email address');
    if (data.hasPartner === 'yes' && !clean.partnerName) throw new Error('Missing partner name');
    if (data.hasPartner !== 'yes') clean.partnerName = '';
    if (['', 'Mr.', 'Mrs.', 'Ms.', 'Rabbi', 'Dr.', 'Other'].indexOf(clean.title) === -1) throw new Error('Invalid title');
    if (clean.title === 'Other') {
      if (!clean.titleOther) throw new Error('Missing custom title');
      clean.title = clean.titleOther;
    }
    if (['yes', 'maybe', 'no'].indexOf(data.attendance) === -1) throw new Error('Invalid attendance');
    var spreadsheetId = properties.getProperty('SPREADSHEET_ID') || '1vFlW31srW1Y-NUID5nPAWbvNnkK2LUttqqhWI_r7h5g';
    if (!spreadsheetId) throw new Error('Missing spreadsheet');
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    var sheet = spreadsheet.getSheetByName('Guest responses') || spreadsheet.insertSheet('Guest responses');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Received', 'Response ID', 'First name', 'Last name', 'Partner name', 'Street', 'Apartment / suite', 'City', 'State / region', 'ZIP / postal code', 'Country', 'Likely attendance', 'Title', 'Email Address']);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#ead0d0');
    }
    // Append the new column without shifting existing guest data.
    var titleHeader = sheet.getRange(1, 13);
    var existingTitleHeader = titleHeader.getValue();
    if (!existingTitleHeader) titleHeader.setValue('Title').setFontWeight('bold').setBackground('#ead0d0');
    else if (existingTitleHeader !== 'Title') throw new Error('Unexpected response column');
    var emailHeader = sheet.getRange(1, 14);
    var existingEmailHeader = emailHeader.getValue();
    if (!existingEmailHeader) emailHeader.setValue('Email Address').setFontWeight('bold').setBackground('#ead0d0');
    else if (existingEmailHeader !== 'Email Address') throw new Error('Unexpected response column');
    var duplicate = sheet.getLastRow() > 1 && sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext();
    if (!duplicate) {
      // The leading apostrophe tells Sheets to treat every user-supplied value literally.
      // This prevents formulas and automatic conversion of ZIPs, units, and street numbers.
      var safe = function(value) { return value ? "'" + value : ''; };
      var attendance = { yes: 'Wouldn’t miss it', maybe: 'Hope so', no: 'Celebrating from afar' };
      // Mailing addresses are text. Preserve leading zeros in ZIP codes and unit numbers.
      sheet.getRange(sheet.getLastRow() + 1, 3, 1, 9).setNumberFormat('@');
      sheet.getRange(sheet.getLastRow() + 1, 13, 1, 2).setNumberFormat('@');
      sheet.appendRow([new Date(), requestId, safe(clean.firstName), safe(clean.lastName), safe(clean.partnerName), safe(clean.street), safe(clean.unit), safe(clean.city), safe(clean.region), safe(clean.postalCode), safe(clean.country), attendance[data.attendance], safe(clean.title), safe(clean.email)]);
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
