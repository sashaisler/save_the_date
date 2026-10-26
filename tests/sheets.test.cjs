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
console.log('Passed: confirmed writes, retries, formula handling, partner validation, invalid data, spam, and write failures.');
