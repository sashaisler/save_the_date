(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const story = document.querySelector('#story');
  const stage = story.querySelector('.story-pin');
  const scenes = Array.from(story.querySelectorAll('[data-scene]'));
  const progressFill = story.querySelector('.timeline-track i');
  const progressMarker = story.querySelector('.timeline-position');
  const chapter = story.querySelector('.chapter-number');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  let framePending = false;
  let metricsDirty = true;
  let storyTop = 0;
  let scrollRange = 1;
  let currentScene = -1;
  let previousProgress = -1;

  // Layout is read only on load/resize, never on each scroll frame.
  const measure = () => {
    storyTop = story.getBoundingClientRect().top + window.scrollY;
    scrollRange = Math.max(1, story.offsetHeight - stage.offsetHeight);
    metricsDirty = false;
  };
  const draw = () => {
    framePending = false;
    if (metricsDirty) measure();
    const progress = clamp((window.scrollY - storyTop) / scrollRange);
    if (progress === previousProgress) return;
    previousProgress = progress;
    const playhead = progress * (scenes.length - 1);
    const active = Math.round(playhead);

    // Only the small progress bar follows scroll position. Scene fades run on
    // their own clock, so sparse scroll events and fast swipes cannot skip them.
    progressFill.style.transform = `scaleY(${progress})`;
    progressMarker.style.top = `${progress * 100}%`;
    if (active !== currentScene) {
      scenes.forEach((scene, index) => {
        const isCurrent = index === active;
        scene.classList.toggle('is-current', isCurrent);
        scene.classList.toggle('is-before', index < active);
        scene.setAttribute('aria-hidden', String(!isCurrent));
        scene.inert = !isCurrent;
      });
      chapter.textContent = String(active + 1).padStart(2, '0');
      currentScene = active;
      root.classList.add('story-ready');
    }
  };
  const schedule = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(draw);
  };
  const invalidateMetrics = () => {
    metricsDirty = true;
    previousProgress = -1;
    schedule();
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', invalidateMetrics, { passive: true });
  window.addEventListener('pageshow', invalidateMetrics);
  window.addEventListener('load', invalidateMetrics);
  motion.addEventListener('change', invalidateMetrics);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(invalidateMetrics);
    observer.observe(story);
    observer.observe(stage);
  }
  // Stop decorative animations while guests fill in the questions or switch tabs.
  let storyVisible = true;
  const syncVisibility = () => root.classList.toggle('story-offscreen', !storyVisible || document.hidden);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      storyVisible = entries[0].isIntersecting;
      syncVisibility();
    });
    observer.observe(story);
  }
  document.addEventListener('visibilitychange', syncVisibility);
  invalidateMetrics();
})();
