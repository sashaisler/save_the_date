const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('dist/story.js', 'utf8');
function fixture(observerSupported = true) {
  const classes = new Set(), events = {};
  let visibilityCallback;
  const invitation = {};
  const document = { hidden:false, documentElement:{classList:{add:n=>classes.add(n),toggle(n,on){on?classes.add(n):classes.delete(n);}}},
    querySelector:s=>{assert.equal(s,'#story');return invitation;}, addEventListener:(name,callback)=>{events[name]=callback;} };
  class IntersectionObserver {constructor(callback){visibilityCallback=callback;} observe(target){assert.equal(target,invitation);}}
  const window = observerSupported ? {IntersectionObserver} : {};
  vm.runInNewContext(source,{document,window,IntersectionObserver});
  return {classes,document,events,intersect:on=>visibilityCallback([{isIntersecting:on}])};
}
const page=fixture();
assert.ok(page.classes.has('js'));
assert.ok(!page.classes.has('story-offscreen'));
page.intersect(false);assert.ok(page.classes.has('story-offscreen'),'Decoration pauses while filling in the form');
page.intersect(true);assert.ok(!page.classes.has('story-offscreen'),'Decoration resumes on returning to the invitation');
page.document.hidden=true;page.events.visibilitychange();assert.ok(page.classes.has('story-offscreen'),'A hidden tab pauses decoration');
page.document.hidden=false;page.events.visibilitychange();assert.ok(!page.classes.has('story-offscreen'));
const fallback=fixture(false);fallback.document.hidden=true;fallback.events.visibilitychange();assert.ok(fallback.classes.has('story-offscreen'));
console.log('Passed: normal-flow invitation, offscreen decoration pauses, tab visibility, and observer fallback.');
