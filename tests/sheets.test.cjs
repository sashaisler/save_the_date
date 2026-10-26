const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const rows = [];
let failWrite = false;
const textRanges = [];
const sheet = {
  getLastRow: () => rows.length,
  appendRow: row => { if (failWrite) throw Error('Service unavailable'); rows.push(row); },
  setFrozenRows() {},
  getRange: (row, column, count, width) => ({
    setFontWeight() { return this; }, setBackground() { return this; },
    getValue: () => rows[row - 1]?.[column - 1] || '',
    setValue(value) { rows[row - 1][column - 1] = value; return this; },
    setNumberFormat(format) { textRanges.push({row, column, count, width, format}); return this; },
    createTextFinder: text => ({ matchEntireCell() { return this; }, findNext: () => rows.slice(row - 1, row - 1 + count).find(item => item[column - 1] === text) || null })
  })
};
const context = {
  PropertiesService: {getScriptProperties: () => ({getProperty: key => ({SITE_ORIGIN:'https://example.com', SPREADSHEET_ID:'test-sheet'})[key]})},
  LockService: {getScriptLock: () => ({waitLock(){}, hasLock:()=>true, releaseLock(){}})},
  SpreadsheetApp: {openById: () => ({getSheetByName: () => sheet})},
  HtmlService: {XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput: html => ({html,setXFrameOptionsMode(){return this;}})}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('google-sheets/Code.gs','utf8'), context);
const valid = {requestId:'12345678-1234-4234-8234-123456789012',firstName:'Guest',lastName:'Example',street:'123 Example St',city:'Example',region:'NY',postalCode:'00000',country:'United States',attendance:'yes'};
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
console.log('Passed: writes, retries, formula handling, validation, titles, custom titles, and existing-sheet migration.');
