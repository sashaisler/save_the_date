const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const rows = [];
let failWrite = false;
const textRanges = [];
const properties = {SITE_ORIGIN:'https://example.com', SPREADSHEET_ID:'test-sheet'};
const emails = [];
const triggers = [];
let quota = 100, failEmail = false, failTracking = '';
let effectiveEmail = 'eytan.sasha.abramowitz@gmail.com';
const display = value => typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value == null ? '' : String(value);
const sheet = {
  getLastRow: () => rows.length,
  appendRow: row => { if (failWrite) throw Error('Service unavailable'); rows.push(row); },
  setFrozenRows() {},
  getRange: (row, column, count, width) => ({
    setFontWeight() { return this; }, setBackground() { return this; },
    getValue: () => rows[row - 1]?.[column - 1] || '',
    setValue(value) { rows[row - 1][column - 1] = value; return this; },
    getDisplayValues: () => Array.from({length:count || 1},(_,i) => Array.from({length:width || 1},(_,j) => display(rows[row - 1 + i]?.[column - 1 + j]))),
    setValues(values) {
      if (failTracking && values[0][0] === failTracking) throw Error('Tracking write failed');
      values.forEach((items,i) => items.forEach((value,j) => { rows[row-1+i][column-1+j]=value; })); return this;
    },
    setNumberFormat(format) { textRanges.push({row, column, count, width, format}); return this; },
    createTextFinder: text => ({ matchEntireCell() { return this; }, findNext: () => { const index = rows.findIndex((item,i) => i >= row-1 && i < row-1+count && item[column-1]===text); return index < 0 ? null : {getRow:()=>index+1}; } })
  })
};
const context = {
  Session: {getEffectiveUser:()=>({getEmail:()=>effectiveEmail})},
  PropertiesService: {getScriptProperties: () => ({getProperty: key => properties[key],setProperty:(key,value) => {properties[key]=value;}})},
  LockService: {getScriptLock: () => ({waitLock(){}, tryLock:()=>true, hasLock:()=>true, releaseLock(){}})},
  SpreadsheetApp: {openById: () => ({getSheetByName: () => sheet}),flush(){}},
  MailApp: {getRemainingDailyQuota:()=>quota,sendEmail: email => { if(failEmail) throw Error('Send unavailable'); emails.push(email); quota--; }},
  ScriptApp: {getProjectTriggers:()=>triggers,newTrigger: handler => ({timeBased(){return this;},everyHours(hours){assert.equal(hours,1);return this;},create(){triggers.push({getHandlerFunction:()=>handler});}})},
  HtmlService: {XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput: html => ({html,setXFrameOptionsMode(){return this;}})}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('google-sheets/Code.gs','utf8'), context);
const valid = {requestId:'12345678-1234-4234-8234-123456789012',firstName:'Guest',lastName:'Example',email:'guest@example.com',street:'123 Example St',city:'Example',region:'NY',postalCode:'00000',country:'United States',attendance:'yes'};
const post = values => {
  const result = context.doPost({contentLength:1000,parameter:{...valid,...values}});
  return JSON.parse(result.html.match(/postMessage\((\{.*?\}),/)[1]);
};
assert.equal(post({}).ok, true);
assert.equal(rows.length,2,'Creates header and response');
assert.equal(textRanges[0].format,'@','Store name and address columns as text, including postal codes');
assert.equal(textRanges[0].column,3);
assert.equal(textRanges[0].count,1);
assert.equal(textRanges[0].width,9,'Text formatting includes the postal-code column');
assert.equal(post({}).ok,true);
assert.equal(rows.length,2,'Retries do not duplicate a row');
assert.equal(post({requestId:'22345678-1234-4234-8234-123456789012',firstName:'=IMPORTXML("x")'}).ok,true);
assert.equal(rows[2][2],'\'=IMPORTXML("x")','Neutralizes spreadsheet formulas');
assert.equal(post({hasPartner:'yes',partnerName:''}).ok,false,'Partner name required when included');
assert.equal(post({attendance:'invalid'}).ok,false);
assert.equal(post({street:''}).ok,false);
assert.equal(post({website:'spam.example'}).ok,false);
assert.equal(post({firstName:'x'.repeat(101)}).ok,false);
assert.equal(post({requestId:'<script>'}).ok,false);
failWrite=true;
assert.equal(post({requestId:'32345678-1234-4234-8234-123456789012'}).ok,false,'Failed writes never return success');
assert.equal(rows.length,3,'Invalid submissions never write rows');
const githubResult = context.doPost({contentLength:1000,parameter:{...valid,siteOrigin:'https://sashaisler.github.io'}});
assert.match(githubResult.html, /,"https:\/\/sashaisler.github.io"\)/,'Confirm GitHub submissions to the GitHub origin');
const beforeInvalidOrigin = rows.length;
const untrustedResult = context.doPost({contentLength:1000,parameter:{...valid,siteOrigin:'https://untrusted.example'}});
assert.doesNotMatch(untrustedResult.html,/postMessage/,'Never send acknowledgements to an unconfigured host');
assert.equal(rows.length,beforeInvalidOrigin,'Unconfigured hosts do not write rows');
failWrite=false;
assert.equal(rows[0][12],'Title','New sheets include a separate title column');
assert.equal(rows[0][13],'Email Address','New sheets include a separate email column');
const nextId = () => `${String(rows.length + 100).padStart(8,'0')}-1234-4234-8234-123456789012`;
for (const title of ['Mr.', 'Mrs.', 'Ms.', 'Rabbi', 'Dr.']) {
  assert.equal(post({requestId:nextId(),title}).ok,true);
  assert.equal(rows.at(-1)[12],"'"+title,'Saves each standard title literally');
}
assert.equal(post({requestId:nextId(),title:'Other',titleOther:'  Prof.  '}).ok,true);
assert.equal(rows.at(-1)[12],"'Prof.",'Trims and saves a custom title');
assert.equal(post({requestId:nextId(),title:'Other',titleOther:'=IMPORTXML("x")'}).ok,true);
assert.equal(rows.at(-1)[12],'\'=IMPORTXML("x")','Custom titles cannot become spreadsheet formulas');
const beforeInvalidTitle=rows.length;
for (const values of [{title:'Other',titleOther:''},{title:'Other',titleOther:' '.repeat(4)},{title:'Other',titleOther:'x'.repeat(101)},{title:'Unexpected'}]) {
  assert.equal(post({requestId:nextId(),...values}).ok,false,'Rejects invalid or empty custom titles');
}
assert.equal(rows.length,beforeInvalidTitle,'Invalid titles never write rows');
assert.equal(post({requestId:nextId(),title:'Dr.',titleOther:'Prof.'}).ok,true);
assert.equal(rows.at(-1)[12],"'Dr.",'A standard selection ignores stale custom-title text');
// Simulate the current twelve-column sheet, including an existing guest response.
rows.length=0;
rows.push(['Received','Response ID','First name','Last name','Partner name','Street','Apartment / suite','City','State / region','ZIP / postal code','Country','Likely attendance']);
const oldRow=['existing date','old-id','Existing','Guest','','1 Main St','','Town','NY','00123','United States','Hope so'];
rows.push([...oldRow]);
assert.equal(post({requestId:nextId(),title:'Rabbi'}).ok,true);
assert.equal(rows[0][12],'Title','Adds a title header to an existing sheet');
assert.deepEqual(rows[1],oldRow,'Existing responses and columns remain unchanged');
assert.equal(rows.at(-1)[9],"'00000",'ZIP codes remain in their original column');
assert.equal(rows.at(-1)[12],"'Rabbi",'New responses put the title in column M');
assert.equal(rows[0][13],'Email Address','Adds the email header without shifting existing columns');
assert.equal(rows.at(-1)[13],"'guest@example.com",'Email addresses go in column N');
assert.equal(post({requestId:nextId(),email:'  Guest+Wedding@Example.com  '}).ok,true);
assert.equal(rows.at(-1)[13],"'Guest+Wedding@Example.com",'Trims email without changing its case or plus tag');
assert.equal(post({requestId:nextId(),email:'=alerts@example.com'}).ok,true);
assert.equal(rows.at(-1)[13],"'=alerts@example.com",'Email addresses cannot become spreadsheet formulas');
const beforeInvalidEmail=rows.length;
for (const email of ['', '  ', 'not-an-email', 'a@@example.com', 'guest name@example.com', 'guest@', 'x'.repeat(250)+'@example.com']) {
  assert.equal(post({requestId:nextId(),email}).ok,false,'Rejects missing or malformed email addresses');
}
assert.equal(rows.length,beforeInvalidEmail,'Invalid emails never write rows');
assert.equal(emails.length,0,'Sending stays disabled before owner authorization');
context.enableConfirmationEmails(); context.enableConfirmationEmails();
assert.equal(triggers.length,1,'Enabling twice creates only one queue trigger');
assert.equal(properties.CONFIRMATION_EMAILS_ENABLED,'true');
const emailRequest = nextId();
assert.equal(post({requestId:emailRequest,title:'Dr.',firstName:'A < B & C',hasPartner:'yes',partnerName:'Saved Spouse',email:'confirmed@example.com',attendance:'maybe'}).emailStatus,'sent');
assert.equal(emails.length,1);
assert.equal(emails[0].to,'confirmed@example.com');
assert.match(emails[0].body,/Dr\./);
assert.match(emails[0].body,/Saved Spouse/);
assert.match(emails[0].body,/ZIP \/ postal code: 00000/);
assert.match(emails[0].body,/Can you attend\?: Not sure yet/);
assert.match(emails[0].htmlBody,/A &lt; B &amp; C/,'Escapes guest text in HTML');
assert.doesNotMatch(emails[0].htmlBody,/>A < B & C</);
assert.equal(rows.at(-1)[14],'Sent');
assert.ok(rows.at(-1)[15] instanceof Date || String(rows.at(-1)[15]));
assert.equal(rows.at(-1)[16],1);
assert.equal(post({requestId:emailRequest,email:'different@example.com'}).emailStatus,'sent');
assert.equal(emails.length,1,'Repeated submissions never email again or change the recipient');
quota=0;
const queuedId=nextId();
assert.equal(post({requestId:queuedId,email:'queued@example.com',firstName:'Saved Name'}).emailStatus,'queued');
assert.equal(rows.at(-1)[16],0,'Quota exhaustion does not consume an attempt');
assert.equal(emails.length,1);
quota=100;
assert.equal(post({requestId:queuedId,email:'wrong@example.com',firstName:'Wrong Name'}).emailStatus,'sent');
assert.equal(emails.at(-1).to,'queued@example.com','Retries email the saved recipient');
assert.match(emails.at(-1).body,/Saved Name/,'Retries email the saved answers');
failWrite=true;
const beforeWriteFailure=emails.length;
assert.equal(post({requestId:nextId()}).ok,false);
assert.equal(emails.length,beforeWriteFailure,'A failed save never sends an email');
failWrite=false;
failEmail=true;
const failedId=nextId();
const failedResult=post({requestId:failedId});
assert.equal(failedResult.ok,true,'A mail failure does not discard a saved response');
assert.equal(failedResult.emailStatus,'queued');
assert.equal(rows.at(-1)[14],'Retry');
post({requestId:failedId}); post({requestId:failedId});
assert.equal(rows.at(-1)[14],'Failed');
assert.equal(rows.at(-1)[16],3,'Caps send attempts');
failEmail=false;
quota=0;
assert.equal(post({requestId:nextId(),email:'queue-only@example.com'}).emailStatus,'queued');
const queueRow=rows.at(-1);
quota=100;
context.sendPendingConfirmations();
assert.equal(queueRow[14],'Sent','Hourly queue sends pending confirmations');
assert.equal(rows[1][14],undefined,'Historical responses are never emailed automatically');
const afterSweep=emails.length;
context.sendPendingConfirmations();
assert.equal(emails.length,afterSweep,'Queue never repeats a sent or permanently failed email');
failTracking='Sent';
const ambiguousId=nextId();
assert.equal(post({requestId:ambiguousId}).ok,true);
assert.equal(rows.at(-1)[14],'Sending');
failTracking='';
const afterAmbiguous=emails.length;
context.sendPendingConfirmations(); post({requestId:ambiguousId});
assert.equal(emails.length,afterAmbiguous,'Ambiguous sends require owner review, never automatic duplication');
const beforeSenderSwitch=emails.length;
effectiveEmail='sashaisler@gmail.com';
const senderSwitchId=nextId();
assert.equal(post({requestId:senderSwitchId}).emailStatus,'queued','Old-account deployments still save responses but do not send');
assert.equal(rows.at(-1)[16],0,'Wrong sender does not consume email attempts');
context.sendPendingConfirmations();
assert.equal(emails.length,beforeSenderSwitch,'Old-account triggers cannot send confirmations');
assert.throws(()=>context.enableConfirmationEmails(),/configured wedding email account/);
effectiveEmail='';
assert.equal(context.confirmationSenderAllowed_(),false,'Missing execution identity cannot send');
effectiveEmail='eytan.sasha.abramowitz@gmail.com';
context.sendPendingConfirmations();
assert.equal(rows.at(-1)[14],'Sent','Wedding account sends responses queued by old deployments');
assert.equal(emails.length,beforeSenderSwitch+1);
// Produce a fictional preview using the actual email template.
const previewRow=['','','Alex','Example','Jordan Example','123 Sample Street','4B','Sample Town','NY','00123','United States','Hope so','Dr.','alex@example.com'];
fs.writeFileSync('/private/tmp/wedding-confirmation-preview.html',context.confirmationEmail_(previewRow).htmlBody);
console.log('Passed: saved responses, validation, migration, confirmation content, escaping, deduplication, quotas, queue, send failures and owner enablement.');
