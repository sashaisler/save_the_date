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
  const begin = node(), pause = node();
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
    querySelector: selector => ({ '#story': story, '#begin-story': begin, '#motion-toggle': pause })[selector],
    addEventListener(key, callback) { documentEvents[key] = callback; } };
  const flush = () => { let count = 0; while (frames.length) { assert.ok(count++ < 10, 'No animation-frame loop'); frames.shift()(); } };
  vm.runInNewContext(source, { window, document, ResizeObserver, IntersectionObserver,
    requestAnimationFrame: callback => frames.push(callback) });
  flush();
  return { root, scenes, artwork, fill, chapter, motion, begin, pause, window, document, frames,
    reads: () => layoutReads, writes: () => styleWrites, flush,
    scroll(progress) { window.scrollY = 200 + (storyHeight - 1000) * progress; windowEvents.scroll.callback(); flush(); },
    resize(height) { storyHeight = height; resizeObservers[0](); flush(); },
    intersect(visible) { intersections[0]([{ isIntersecting: visible }]); },
    visibility(hidden) { document.hidden = hidden; documentEvents.visibilitychange(); }, windowEvents };
}

const native = fixture({ native: true });
assert.ok(native.root.classList.contains('native-story'));
const nativeReads = native.reads(), nativeWrites = native.writes();
for (let i = 0; i <= 100; i++) native.scroll(i / 100);
assert.equal(native.reads(), nativeReads, 'Native scrolling never measures layout per frame');
assert.equal(native.writes(), nativeWrites, 'Native scrolling never writes inline animation styles');
assert.equal(native.chapter.textContent, '04');
assert.equal(native.scenes[3].inert, false);
assert.equal(native.scenes[0].attributes['aria-hidden'], 'true');
assert.equal(native.windowEvents.scroll.options.passive, true);

const fallback = fixture();
const fallbackReads = fallback.reads();
for (let i = 0; i <= 100; i++) fallback.scroll(i / 100);
assert.equal(fallback.reads(), fallbackReads, 'Fallback scrolling uses cached geometry');
assert.equal(fallback.artwork.style.transform, undefined, 'Phone fallback does not animate the large background');
for (const midpoint of [1 / 6, .5, 5 / 6]) {
  fallback.scroll(midpoint);
  const totalOpacity = fallback.scenes.reduce((sum, scene) => sum + Number(scene.style.opacity), 0);
  assert.ok(totalOpacity > .99, 'Chapter transitions never leave the screen blank');
}
fallback.scroll(-.5);
assert.equal(fallback.scenes[0].style.opacity, '1', 'Top rubberbanding keeps the opening visible');
fallback.scroll(2);
const afterStoryWrites = fallback.writes();
fallback.scroll(3);
assert.equal(fallback.writes(), afterStoryWrites, 'Scrolling through the questions does no extra animation work');
fallback.resize(6000);
assert.ok(fallback.reads() > fallbackReads, 'Resize refreshes cached geometry');
fallback.begin.events.click(); fallback.flush();
assert.equal(fallback.window.lastScroll.top, 200 + 5000 / 3);
assert.equal(fallback.chapter.textContent, '02', 'Scroll invitation reaches the portrait after resize');
fallback.windowEvents.scroll.callback(); fallback.windowEvents.scroll.callback();
assert.equal(fallback.frames.length, 1, 'Multiple scroll events coalesce into one frame');
fallback.flush();

native.motion.matches = true; native.motion.change(); native.flush();
assert.equal(native.root.classList.contains('native-story'), false);
native.scroll(.5);
assert.equal(native.scenes[2].style.opacity, '1');
assert.ok(native.scenes.every(scene => scene.style.transform === 'none'), 'Reduced motion removes scene movement');
native.motion.matches = false; native.motion.change(); native.flush();
assert.ok(native.root.classList.contains('native-story'));
assert.ok(native.scenes.every(scene => scene.style.opacity === undefined), 'Returning to native animation clears fallback styles');
native.intersect(false);
assert.ok(native.root.classList.contains('story-offscreen'));
native.intersect(true); native.visibility(true);
assert.ok(native.root.classList.contains('story-offscreen'));
native.visibility(false);
assert.equal(native.root.classList.contains('story-offscreen'), false);
native.pause.events.click({ currentTarget: native.pause });
assert.equal(native.pause.attributes['aria-pressed'], 'true');
console.log('Passed: native scroll rendering, cached fallback geometry, continuous crossfades, resize, reduced motion, and offscreen pauses.');
