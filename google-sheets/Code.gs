/**
 * Bound to your private response spreadsheet via Extensions > Apps Script.
 * Already configured for Sasha and Eytan’s response spreadsheet and website.
 * Paste this whole file into Extensions > Apps Script, save, and deploy as a web app.
 * Run enableConfirmationEmails once as the owner to authorize sending and enable the queue.
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
  var emailStatus = 'not_requested';
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
    ensureConfirmationColumns_(sheet);
    var duplicate = sheet.getLastRow() > 1 && sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext();
    var responseRow = duplicate ? duplicate.getRow() : sheet.getLastRow() + 1;
    if (!duplicate) {
      // The leading apostrophe tells Sheets to treat every user-supplied value literally.
      // This prevents formulas and automatic conversion of ZIPs, units, and street numbers.
      var safe = function(value) { return value ? "'" + value : ''; };
      var attendance = { yes: 'Wouldn’t miss it', maybe: 'Hope so', no: 'Celebrating from afar' };
      // Mailing addresses are text. Preserve leading zeros in ZIP codes and unit numbers.
      sheet.getRange(sheet.getLastRow() + 1, 3, 1, 9).setNumberFormat('@');
      sheet.getRange(sheet.getLastRow() + 1, 13, 1, 2).setNumberFormat('@');
      sheet.appendRow([new Date(), requestId, safe(clean.firstName), safe(clean.lastName), safe(clean.partnerName), safe(clean.street), safe(clean.unit), safe(clean.city), safe(clean.region), safe(clean.postalCode), safe(clean.country), attendance[data.attendance], safe(clean.title), safe(clean.email), 'Queued', '', 0]);
    }
    ok = true;
    // Email failure must never turn a successfully saved response into a failed submission.
    try { emailStatus = sendConfirmationForRow_(sheet, responseRow); }
    catch (emailError) { emailStatus = 'pending'; }
  } catch (error) {
    // Never expose guest details or internal error messages to the browser.
    ok = false;
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
  // Native cross-origin form POST + a verified acknowledgement avoids opaque no-cors "success".
  var payload = JSON.stringify({ type: 'wedding-response', requestId: requestId, ok: ok, emailStatus: emailStatus }).replace(/</g, '\\u003c');
  var destination = JSON.stringify(origin).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.top.postMessage(' + payload + ',' + destination + ');</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet() {
  return HtmlService.createHtmlOutput('Wedding response service. Submit your details through the wedding website.');
}


// Append tracking fields; never change the positions of existing guest data.
function ensureConfirmationColumns_(sheet) {
  ['Confirmation email', 'Email sent at', 'Email attempts'].forEach(function(label, index) {
    var cell = sheet.getRange(1, 15 + index);
    var existing = cell.getValue();
    if (!existing) cell.setValue(label).setFontWeight('bold').setBackground('#ead0d0');
    else if (existing !== label) throw new Error('Unexpected confirmation column');
  });
}

function confirmationEmail_(row) {
  var attendance = { 'Wouldn’t miss it': 'Yes', 'Hope so': 'Not sure yet', 'Celebrating from afar': 'No' };
  var answers = [
    ['Title', row[12]], ['First name', row[2]], ['Last name', row[3]],
    ["Spouse or Fiance's Name (if applicable)", row[4]], ['Email Address', row[13]],
    ['Street address', row[5]], ['Apartment / suite', row[6]], ['City', row[7]],
    ['State / region', row[8]], ['ZIP / postal code', row[9]], ['Country', row[10]],
    ['Can you attend?', attendance[row[11]] || row[11]]
  ];
  var escape = function(value) {
    return String(value || 'Not provided').replace(/[&<>"']/g, function(character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  };
  var wedding = 'Sunday, June 20, 2027 · Woodbury Jewish Center, NY';
  var note = 'This is your save-the-date response. A formal invitation and final RSVP will follow.';
  var table = answers.map(function(answer) {
    return '<tr><th scope="row" style="padding:12px 0;border-bottom:1px solid #dce5e8;text-align:left;font:normal 13px Arial,sans-serif;color:#496477;width:46%;vertical-align:top">' + escape(answer[0]) + '</th><td style="padding:12px 0 12px 16px;border-bottom:1px solid #dce5e8;font:15px Arial,sans-serif;color:#17334c;vertical-align:top;word-break:break-word">' + escape(answer[1]) + '</td></tr>';
  }).join('');
  return {
    to: row[13],
    subject: 'Sasha & Eytan — Your save-the-date response',
    name: 'Sasha & Eytan',
    body: 'Sasha & Eytan\n' + wedding + '\n\nYour response has been saved.\n\n' + answers.map(function(answer) { return answer[0] + ': ' + (answer[1] || 'Not provided'); }).join('\n') + '\n\n' + note + '\nFor corrections, reply to this email.',
    htmlBody: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f4f7f7"><div style="max-width:560px;margin:auto;padding:32px 24px;background:#fff;border-top:5px solid #b9d9eb;color:#17334c"><h1 style="margin:0 0 12px;font:normal 32px Georgia,serif">Sasha &amp; Eytan</h1><p style="font:13px/1.7 Arial,sans-serif;color:#496477">' + wedding + '</p><h2 style="margin:28px 0 12px;font:normal 23px Georgia,serif">Your response has been saved.</h2><table style="border-collapse:collapse;width:100%;table-layout:fixed">' + table + '</table><p style="margin-top:26px;font:13px/1.7 Arial,sans-serif;color:#496477">' + note + '</p><p style="font:13px/1.7 Arial,sans-serif;color:#496477">For corrections, reply to this email.</p></div></body></html>'
  };
}

// Caller holds the script lock. Always use the saved answers, never retry request data.
function sendConfirmationForRow_(sheet, rowNumber) {
  var row = sheet.getRange(rowNumber, 1, 1, 17).getDisplayValues()[0];
  var status = row[14];
  if (status === 'Sent') return 'sent';
  if (!status) return 'not_requested'; // Historical responses are not emailed automatically.
  if (status !== 'Queued' && status !== 'Retry') return 'failed';
  var attempts = Number(row[16]) || 0;
  var tracking = sheet.getRange(rowNumber, 15, 1, 3);
  if (attempts >= 3) { tracking.setValues([['Failed', '', attempts]]); return 'failed'; }
  if (PropertiesService.getScriptProperties().getProperty('CONFIRMATION_EMAILS_ENABLED') !== 'true') return 'queued';
  if (MailApp.getRemainingDailyQuota() < 1) return 'queued';
  // Record the attempt before sending. An interrupted "Sending" row needs owner review,
  // since automatically retrying an ambiguous send could deliver a duplicate email.
  tracking.setValues([['Sending', '', attempts + 1]]);
  SpreadsheetApp.flush();
  try { MailApp.sendEmail(confirmationEmail_(row)); }
  catch (error) {
    tracking.setValues([[attempts + 1 >= 3 ? 'Failed' : 'Retry', '', attempts + 1]]);
    return attempts + 1 >= 3 ? 'failed' : 'queued';
  }
  tracking.setValues([['Sent', new Date(), attempts + 1]]);
  return 'sent';
}

function sendPendingConfirmations() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('CONFIRMATION_EMAILS_ENABLED') !== 'true') return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var spreadsheetId = properties.getProperty('SPREADSHEET_ID') || '1vFlW31srW1Y-NUID5nPAWbvNnkK2LUttqqhWI_r7h5g';
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Guest responses');
    if (!sheet || sheet.getLastRow() < 2) return;
    ensureConfirmationColumns_(sheet);
    var statuses = sheet.getRange(2, 15, sheet.getLastRow() - 1, 1).getDisplayValues();
    var processed = 0;
    for (var index = 0; index < statuses.length && processed < 25; index++) {
      if (statuses[index][0] !== 'Queued' && statuses[index][0] !== 'Retry') continue;
      if (MailApp.getRemainingDailyQuota() < 1) break;
      try { sendConfirmationForRow_(sheet, index + 2); } catch (error) { /* Keep other saved responses processing. */ }
      processed++;
    }
  } finally { lock.releaseLock(); }
}

// Run manually once as the owner. Google will request send-mail and trigger permissions.
function enableConfirmationEmails() {
  MailApp.getRemainingDailyQuota();
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'sendPendingConfirmations';
  });
  if (!exists) ScriptApp.newTrigger('sendPendingConfirmations').timeBased().everyHours(1).create();
  PropertiesService.getScriptProperties().setProperty('CONFIRMATION_EMAILS_ENABLED', 'true');
}
