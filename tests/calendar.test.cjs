const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const configuration = {window:{}};
vm.runInNewContext(fs.readFileSync('dist/config.js','utf8'),configuration);
const source = fs.readFileSync('dist/app.js','utf8');
const begin = source.indexOf("  const calendarLink = $('#calendar');");
const end = source.indexOf('\n\n  const form',begin);
assert.ok(begin >= 0 && end > begin);
const link = {};
vm.runInNewContext(source.slice(begin,end), {
  config:configuration.window.WEDDING, URL, URLSearchParams,
  $:selector=>{assert.equal(selector,'#calendar');return link;}
});
const google=new URL(link.href);
assert.equal(google.origin,'https://calendar.google.com');
assert.equal(google.pathname,'/calendar/r/eventedit');
assert.equal(google.searchParams.get('action'),'TEMPLATE');
assert.equal(google.searchParams.get('dates'),'20270620T203000Z/20270620T203000Z');
assert.equal(google.searchParams.get('stz'),'America/New_York');
assert.equal(google.searchParams.get('etz'),'America/New_York');
assert.equal(google.searchParams.get('location'),'Woodbury Jewish Center, Woodbury, New York');
assert.equal(google.searchParams.get('text'),'Sasha & Eytan — Wedding');
assert.match(google.searchParams.get('details'),/End time to be confirmed/);
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(new Date('2027-06-20T20:30:00Z')).map(part=>[part.type,part.value]));
assert.equal(parts.year,'2027'); assert.equal(parts.month,'6'); assert.equal(parts.day,'20');
assert.equal(parts.hour,'4'); assert.equal(parts.minute,'30'); assert.equal(parts.dayPeriod,'PM');
const html=fs.readFileSync('dist/index.html','utf8');
const calendarAnchor=html.match(/<a id="calendar"[^>]*>/)[0];
assert.match(calendarAnchor,/target="_blank"/);
assert.match(calendarAnchor,/rel="noopener noreferrer"/);
const fallback=new URL(calendarAnchor.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));
assert.equal(fallback.href,google.href,'The native link also works before JavaScript runs');
assert.doesNotMatch(html,/calendar-picker|calendar-outlook|calendar-ics/);
console.log('Passed: Add to calendar links directly to the prefilled Google event on all devices, with June 20, 2027 at 4:30 PM New York and no chooser or download.');
