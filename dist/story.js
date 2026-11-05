(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const invitation = document.querySelector('#story');
  // The invitation is a single normal-flow view. Only decorative motion pauses
  // when it is offscreen or the tab is hidden; scrolling never switches content.
  let visible = true;
  const sync = () => root.classList.toggle('story-offscreen', !visible || document.hidden);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    });
    observer.observe(invitation);
  }
  document.addEventListener('visibilitychange', sync);
  sync();
})();
