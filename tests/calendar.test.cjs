const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const configuration = {window:{}};
vm.runInNewContext(fs.readFileSync('dist/config.js','utf8'),configuration);
const source = fs.readFileSync('dist/app.js','utf8');
const begin = source.indexOf("  const calendarButton = $('#calendar');");
const end = source.indexOf('\n\n  const form',begin);
assert.ok(begin >= 0 && end > begin);

function calendarApp(device) {
  const elements = new Map();
  const state = {downloads:[],payloads:[]};
  const select = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      listeners:{}, addEventListener(name, fn){this.listeners[name]=fn;},
      setAttribute(name, value){this[name]=value;},
      showModal(){this.open=true;}, close(){this.open=false;}
    });
    return elements.get(selector);
  };
  class CalendarURL extends URL {
    static createObjectURL(blob){state.payloads.push(blob);return 'blob:calendar-test';}
    static revokeObjectURL(){}
  }
  vm.runInNewContext(source.slice(begin,end), {
    config:configuration.window.WEDDING, Blob, URL:CalendarURL, URLSearchParams,
    $:select, navigator:device, setTimeout(){},
    document:{createElement:()=>({click(){state.downloads.push(this);}})}
  });
  return {...state,element:select,click:selector=>select(selector).listeners.click()};
}

(async () => {
  const desktop=calendarApp({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:0});
  desktop.click('#calendar');
  assert.equal(desktop.element('#calendar-picker').open,true);
  assert.equal(desktop.downloads.length,0,'Mac button should offer calendars without downloading');
  assert.equal(desktop.element('#calendar')['aria-haspopup'],'dialog');
  const google=new URL(desktop.element('#calendar-google').href);
  assert.equal(google.origin,'https://calendar.google.com');
  assert.equal(google.searchParams.get('action'),'TEMPLATE');
  assert.equal(google.searchParams.get('dates'),'20270620T203000Z/20270620T203000Z');
  assert.equal(google.searchParams.get('stz'),'America/New_York');
  assert.equal(google.searchParams.get('etz'),'America/New_York');
  assert.equal(google.searchParams.get('location'),'Woodbury Jewish Center, Woodbury, New York');
  assert.match(google.searchParams.get('details'),/End time to be confirmed/);
  const outlook=new URL(desktop.element('#calendar-outlook').href);
  assert.equal(outlook.origin,'https://outlook.live.com');
  assert.equal(outlook.searchParams.get('startdt'),'2027-06-20T20:30:00.000Z');
  assert.equal(outlook.searchParams.has('enddt'),false);
  desktop.click('#calendar-google');
  assert.equal(desktop.element('#calendar-picker').open,false);
  desktop.click('#calendar'); desktop.click('#calendar-close');
  assert.equal(desktop.element('#calendar-picker').open,false);
  desktop.click('#calendar'); desktop.click('#calendar-ics');
  assert.equal(desktop.downloads.length,1,'File download requires the explicit file choice on Mac');
  assert.equal(desktop.element('#calendar-picker').open,false);
  assert.equal(desktop.downloads[0].download,'sasha-and-eytan-save-the-date.ics');
  const calendar=await desktop.payloads[0].text();
  assert.match(calendar,/\r\nDTSTART:20270620T203000Z\r\n/);
  assert.doesNotMatch(calendar,/VALUE=DATE|DTEND/,'Do not invent a wedding end time');
  assert.match(calendar,/LOCATION:Woodbury Jewish Center\\, Woodbury\\, New York/);
  assert.match(calendar,/DESCRIPTION:4:30 PM New York time/);
  const instant=new Date(outlook.searchParams.get('startdt'));
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(instant).map(part=>[part.type,part.value]));
  assert.equal(parts.year,'2027'); assert.equal(parts.month,'6'); assert.equal(parts.day,'20');
  assert.equal(parts.hour,'4'); assert.equal(parts.minute,'30'); assert.equal(parts.dayPeriod,'PM');
  for (const device of [
    {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS)',platform:'iPhone',maxTouchPoints:5},
    {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',maxTouchPoints:5}
  ]) {
    const phone=calendarApp(device);phone.click('#calendar');
    assert.equal(phone.downloads.length,1,'Preserve existing iPhone/iPad handoff');
    assert.notEqual(phone.element('#calendar-picker').open,true);
  }
  console.log('Passed: Mac opens calendar choices without a download; web links and explicit file option preserve June 20, 2027 at 4:30 PM New York; iPhone/iPad retain their handoff.');
})().catch(error=>{console.error(error);process.exitCode=1;});
