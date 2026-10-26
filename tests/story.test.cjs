const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('dist/story.js', 'utf8');

function fixture({ native = false, reduced = false, compact = true } = {}) {
  const frames = [], resizeObservers = [], intersections = [];
  const windowEvents = {}, documentEvents = {};
  let layoutReads = 0, styleWrites = 0, storyHeight = 4800;
  const node = () => {
    const classes = new Set();
    return {
      attributes: {}, events: {},
      style: new Proxy({ removeProperty(key) { delete this[key]; } }, {
        set(target, key, value) { styleWrites++; target[key] = value; return true; }
      }),
      classList: { add: value => classes.add(value), contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { force ? classes.add(value) : classes.delete(value); return force; } },
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(key, callback) { this.events[key] = callback; }
    };
  };
  const root = node(), story = node(), stage = node(), artwork = node(), fill = node(), chapter = node();
  const scenes = Array.from({ length: 4 }, node);
  const begin = node();
  const media = matches => ({ matches, addEventListener(_, callback) { this.change = callback; } });
  const motion = media(reduced), small = media(compact);
  class ResizeObserver { constructor(callback) { resizeObservers.push(callback); } observe() {} }
  class IntersectionObserver { constructor(callback) { intersections.push(callback); } observe() {} }
  const window = { scrollY: 0, CSS: { supports: () => native }, ResizeObserver, IntersectionObserver,
    matchMedia: query => query.includes('prefers-reduced-motion') ? motion : small,
    addEventListener(key, callback, options) { windowEvents[key] = { callback, options }; },
    scrollTo(options) { this.lastScroll = options; this.scrollY = options.top; windowEvents.scroll.callback(); } };
  Object.defineProperty(story, 'offsetHeight', { get() { layoutReads++; return storyHeight; } });
  Object.defineProperty(stage, 'offsetHeight', { get() { layoutReads++; return 1000; } });
  story.getBoundingClientRect = () => { layoutReads++; return { top: 200 - window.scrollY }; };
  const nodes = { '.story-pin': stage, '.garden-art': artwork, '.timeline-track i': fill, '.chapter-number': chapter };
  story.querySelector = selector => nodes[selector];
  story.querySelectorAll = () => scenes;
  const document = { documentElement: root, hidden: false,
    querySelector: selector => ({ '#story': story, '#begin-story': begin })[selector],
    addEventListener(key, callback) { documentEvents[key] = callback; } };
  const flush = () => { let count = 0; while (frames.length) { assert.ok(count++ < 10, 'No animation-frame loop'); frames.shift()(); } };
  vm.runInNewContext(source, { window, document, ResizeObserver, IntersectionObserver,
    requestAnimationFrame: callback => frames.push(callback) });
  flush();
  return { root, scenes, artwork, fill, chapter, motion, begin, window, document, frames,
    reads: () => layoutReads, writes: () => styleWrites, flush,
    scroll(progress) { window.scrollY = 200 + (storyHeight - 1000) * progress; windowEvents.scroll.callback(); flush(); },
    resize(height) { storyHeight = height; resizeObservers[0](); flush(); },
    intersect(visible) { intersections[0]([{ isIntersecting: visible }]); },
    visibility(hidden) { document.hidden = hidden; documentEvents.visibilitychange(); }, windowEvents };
}

const story = fixture();
assert.ok(story.root.classList.contains('story-ready'));
assert.ok(story.scenes[0].classList.contains('is-current'));
const initialReads = story.reads();
assert.equal(story.fill.style.transform,'scaleY(0)','Progress starts at the top of the vertical track');
story.scroll(.5);
assert.equal(story.fill.style.transform,'scaleY(0.5)','The line fills downward with scrolling');
for (let i = 0; i <= 100; i++) story.scroll(i / 100);
assert.equal(story.reads(), initialReads, 'Scrolling never measures layout per frame');
assert.equal(story.chapter.textContent, '04');
assert.equal(story.fill.style.transform,'scaleY(1)','Venue completes the invitation progress line');
assert.equal(story.scenes[3].inert, false);
assert.equal(story.scenes[0].attributes['aria-hidden'], 'true');
assert.equal(story.windowEvents.scroll.options.passive, true);
assert.ok(story.scenes.every(scene => scene.style.opacity === undefined && scene.style.transform === undefined),
  'CSS owns the fade duration; scroll frames never replace it with instantaneous opacity/transform values');
story.scroll(-.5);
assert.ok(story.scenes[0].classList.contains('is-current'), 'Top rubberbanding keeps the opening active');
story.scroll(1);
assert.ok(story.scenes[3].classList.contains('is-current'), 'A fast swipe can reach the venue');
assert.ok(story.scenes[0].classList.contains('is-before'));
story.scroll(1 / 3);
assert.ok(story.scenes[1].classList.contains('is-current'), 'Reverse scrolling restores the portrait');
assert.equal(story.scenes.filter(scene => !scene.inert).length, 1, 'Only the current chapter is interactive');
story.scroll(2);
const afterStoryWrites = story.writes();
story.scroll(3);
assert.equal(story.writes(), afterStoryWrites, 'Scrolling through the questions does no extra animation work');
story.resize(6000);
assert.ok(story.reads() > initialReads, 'Resize refreshes cached geometry');
story.begin.events.click(); story.flush();
assert.equal(story.window.lastScroll.top, 200 + 5000 / 3);
assert.equal(story.chapter.textContent, '02', 'Scroll invitation reaches the portrait after resize');
story.windowEvents.scroll.callback(); story.windowEvents.scroll.callback();
assert.equal(story.frames.length, 1, 'Multiple scroll events coalesce into one frame');
story.flush();

const reduced = fixture({ reduced: true });
reduced.scroll(.5);
assert.ok(reduced.scenes[2].classList.contains('is-current'));
assert.ok(reduced.scenes.every(scene => scene.style.opacity === undefined), 'Reduced motion leaves the gentle CSS fade intact');
reduced.begin.events.click(); reduced.flush();
assert.equal(reduced.window.lastScroll.behavior, 'instant', 'Reduced motion removes animated page scrolling');
reduced.motion.matches = false; reduced.motion.change(); reduced.flush();
assert.equal(reduced.chapter.textContent, '02', 'Changing the motion preference preserves the active chapter');
story.intersect(false);
assert.ok(story.root.classList.contains('story-offscreen'));
story.intersect(true); story.visibility(true);
assert.ok(story.root.classList.contains('story-offscreen'));
story.visibility(false);
assert.equal(story.root.classList.contains('story-offscreen'), false);
console.log('Passed: CSS-owned fades, cached geometry, fast/reverse scrolling, resize, reduced motion, and offscreen pauses.');
