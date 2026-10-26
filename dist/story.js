(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const story = document.querySelector('#story');
  const stage = story.querySelector('.story-pin');
  const scenes = Array.from(story.querySelectorAll('[data-scene]'));
  const artwork = story.querySelector('.garden-art');
  const progressFill = story.querySelector('.timeline-track i');
  const chapter = story.querySelector('.chapter-number');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compact = window.matchMedia('(max-width: 650px), (hover: none) and (pointer: coarse)');
  const supportsTimeline = window.CSS?.supports('animation-timeline: view()') &&
    window.CSS.supports('animation-range: contain 0% contain 100%') &&
    window.CSS.supports('view-timeline-inset: 0 calc(100% - 100svh)');
  const clamp = value => Math.max(0, Math.min(1, value));
  let nativeTimeline = false;
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

    // Native timelines paint the fades without JS style writes. The fallback
    // uses the same crossfade and cached geometry for older Safari/Firefox.
    if (!nativeTimeline) {
      progressFill.style.transform = `scaleX(${progress})`;
      if (!compact.matches && !motion.matches) {
        artwork.style.transform = `translateX(-50%) scale(${1 + progress * .045})`;
      }
      scenes.forEach((scene, index) => {
        const distance = Math.abs(playhead - index);
        const fade = clamp((.65 - distance) / .3);
        const opacity = motion.matches ? Number(index === active) : fade * fade * (3 - 2 * fade);
        const opacityValue = String(opacity);
        if (scene.style.opacity !== opacityValue) scene.style.opacity = opacityValue;
        // Invisible scenes do not need transform updates or full-screen layers.
        const transform = motion.matches || opacity === 0 ? 'none' :
          `translate3d(0,${Math.max(-.5, Math.min(.5, index - playhead)) * 24}px,0)`;
        if (scene.style.transform !== transform) scene.style.transform = transform;
      });
    }
    if (active !== currentScene) {
      scenes.forEach((scene, index) => {
        const isCurrent = index === active;
        scene.classList.toggle('is-current', isCurrent);
        scene.setAttribute('aria-hidden', String(!isCurrent));
        scene.inert = !isCurrent;
      });
      chapter.textContent = String(active + 1).padStart(2, '0');
      currentScene = active;
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
  const updateMotion = () => {
    nativeTimeline = Boolean(supportsTimeline && !motion.matches);
    root.classList.toggle('native-story', nativeTimeline);
    scenes.forEach(scene => {
      scene.style.removeProperty('opacity');
      scene.style.removeProperty('transform');
    });
    artwork.style.removeProperty('transform');
    progressFill.style.removeProperty('transform');
    invalidateMetrics();
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', invalidateMetrics, { passive: true });
  window.addEventListener('pageshow', invalidateMetrics);
  window.addEventListener('load', invalidateMetrics);
  motion.addEventListener('change', updateMotion);
  compact.addEventListener('change', updateMotion);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(invalidateMetrics);
    observer.observe(story);
    observer.observe(stage);
  }
  document.querySelector('#begin-story').addEventListener('click', () => {
    if (metricsDirty) measure();
    window.scrollTo({ top: storyTop + scrollRange / (scenes.length - 1),
      behavior: motion.matches ? 'instant' : 'smooth' });
  });
  document.querySelector('#motion-toggle').addEventListener('click', event => {
    const paused = root.classList.toggle('motion-paused');
    event.currentTarget.setAttribute('aria-pressed', String(paused));
    event.currentTarget.setAttribute('aria-label', paused ? 'Resume decorative animation' : 'Pause decorative animation');
  });

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
  updateMotion();
})();
