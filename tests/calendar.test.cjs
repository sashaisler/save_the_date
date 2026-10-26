const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

(async () => {
  const configuration = {window:{}};
  vm.runInNewContext(fs.readFileSync('dist/config.js','utf8'),configuration);
  const source = fs.readFileSync('dist/app.js','utf8');
  const begin = source.indexOf("  $('#calendar').addEventListener");
  const end = source.indexOf('\n\n  const form',begin);
  assert.ok(begin >= 0 && end > begin);
  let handler, download, payload;
  const context = {
    config:configuration.window.WEDDING, Blob,
    $:()=>({addEventListener:(_,callback)=>{handler=callback;}}),
    document:{createElement:()=>({click(){download=this;}})},
    URL:{createObjectURL:blob=>{payload=blob;return 'blob:calendar-test';},revokeObjectURL(){}},
    setTimeout(){}
  };
  vm.runInNewContext(source.slice(begin,end),context);
  handler();
  const calendar = await payload.text();
  assert.equal(download.download,'sasha-and-eytan-save-the-date.ics');
  assert.match(calendar,/\r\nDTSTART:20270620T203000Z\r\n/,'4:30 PM New York is 20:30 UTC in June');
  assert.doesNotMatch(calendar,/VALUE=DATE|DTEND/,'A timed start does not invent an end time');
  assert.match(calendar,/LOCATION:Woodbury Jewish Center\\, Woodbury\\, New York/);
  assert.match(calendar,/DESCRIPTION:4:30 PM New York time/);
  const start=calendar.match(/DTSTART:(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/);
  const instant=new Date(`${start[1]}-${start[2]}-${start[3]}T${start[4]}:${start[5]}:${start[6]}Z`);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).formatToParts(instant).map(part=>[part.type,part.value]));
  assert.equal(parts.year,'2027'); assert.equal(parts.month,'6'); assert.equal(parts.day,'20');
  assert.equal(parts.hour,'4'); assert.equal(parts.minute,'30'); assert.equal(parts.dayPeriod,'PM');
  console.log('Passed: downloaded calendar starts June 20, 2027 at 4:30 PM New York time.');
})().catch(error=>{console.error(error);process.exitCode=1;});
