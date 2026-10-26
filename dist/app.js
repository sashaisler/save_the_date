(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const config = window.WEDDING;
  const $ = selector => document.querySelector(selector);
  const clamp = value => Math.max(0, Math.min(1, value));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-name]').forEach(el => { el.textContent = config.names[Number(el.dataset.name)]; });
  document.title = `${config.names.join(' & ')} — A little love story`;
  $('.wedding-date').setAttribute('aria-label', config.dateLabel);
  if (config.venue !== 'Woodbury Jewish Center') $('[data-venue]').textContent = config.venue;
  $('[data-location]').textContent = config.location;
  if (config.time) $('[data-time]').textContent = config.time;
  if (config.registryUrl && /^https:\/\//.test(config.registryUrl)) {
    $('#registry-link').href = config.registryUrl; $('#registry-link').hidden = false; $('#registry-pending').hidden = true;
  }
  for (const [key, path] of Object.entries(config.photos)) {
    if (!path) continue;
    const holder = document.querySelector(`[data-photo="${key}"]`);
    if (!holder) continue;
    const image = new Image(); image.alt = `A favorite moment with ${config.names.join(' and ')}`; image.loading = 'lazy';
    image.addEventListener('load', () => { holder.replaceChildren(image); holder.hidden = false; }); image.src = path;
  }

  // A pinned illustrated scene works like a film whose playhead is your scroll position.
  const story = $('#story');
  const stage = $('.story-pin');
  const scenes = Array.from(document.querySelectorAll('[data-scene]'));
  let framePending = false;
  let currentScene = -1;
  const getStoryRange = () => Math.max(1, story.offsetHeight - stage.offsetHeight);
  const drawStory = () => {
    framePending = false;
    const progress = clamp(-story.getBoundingClientRect().top / getStoryRange());
    const playhead = progress * (scenes.length - 1);
    const active = Math.round(playhead);
    stage.style.setProperty('--story-progress', String(progress));
    stage.style.setProperty('--camera-scale', motion.matches ? '1' : String(1 + progress * .045));
    stage.style.setProperty('--camera-y', motion.matches ? '0px' : `${-progress * 12}px`);
    scenes.forEach((scene, index) => {
      const distance = Math.abs(playhead - index);
      const fade = clamp((.5 - distance) / .18);
      const opacity = motion.matches ? Number(index === active) : fade * fade * (3 - 2 * fade);
      scene.style.opacity = String(opacity);
      scene.style.transform = motion.matches ? 'none' : `translate3d(0,${(index - playhead) * 24}px,0) scale(${1 - Math.min(distance, .5) * .035})`;
      if (active !== currentScene) {
        const isCurrent = index === active;
        scene.classList.toggle('is-current', isCurrent);
        scene.setAttribute('aria-hidden', String(!isCurrent));
        scene.inert = !isCurrent;
      }
    });
    if (active !== currentScene) {
      $('.chapter-number').textContent = String(active + 1).padStart(2, '0');
      currentScene = active;
    }
  };
  const scheduleStory = () => { if (!framePending) { framePending = true; requestAnimationFrame(drawStory); } };
  window.addEventListener('scroll', scheduleStory, { passive: true });
  window.addEventListener('resize', scheduleStory);
  motion.addEventListener('change', scheduleStory);
  $('#begin-story').addEventListener('click', () => {
    const top = story.getBoundingClientRect().top + window.scrollY + getStoryRange() / (scenes.length - 1);
    window.scrollTo({top, behavior: motion.matches ? 'instant' : 'smooth'});
  });
  $('#motion-toggle').addEventListener('click', event => {
    const paused = document.documentElement.classList.toggle('motion-paused');
    const button = event.currentTarget;
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', paused ? 'Resume decorative animation' : 'Pause decorative animation');
  });
  drawStory();

  $('#calendar').addEventListener('click', () => {
    const escapeICS = value => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//June Twenty//Wedding//EN', 'BEGIN:VEVENT',
      'UID:sasha-eytan-20270620@save-the-date', `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      'DTSTART;VALUE=DATE:20270620', 'DTEND;VALUE=DATE:20270621', `SUMMARY:${escapeICS(config.names.join(' & ') + ' are getting married')}`,
      `LOCATION:${escapeICS(config.venue + ', ' + config.location)}`, 'DESCRIPTION:Save the date! Ceremony time and formal invitation to follow.', 'END:VEVENT', 'END:VCALENDAR'];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'sasha-and-eytan-save-the-date.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const form = $('#guest-form');
  const siteOrigin = document.createElement('input');
  siteOrigin.type = 'hidden';
  siteOrigin.name = 'siteOrigin';
  siteOrigin.value = window.location.origin;
  form.append(siteOrigin);

  // The guest questions are three short chapters, with their values retained when going back.
  const steps = Array.from(document.querySelectorAll('[data-step]'));
  const stepLabels = ['01 — A LITTLE ABOUT YOU', '02 — AN INVITATION, JUST FOR YOU', '03 — SAVE A LITTLE SPACE FOR US'];
  let currentStep = 0;
  const showStep = (index, focus = true) => {
    currentStep = Math.max(0, Math.min(steps.length - 1, index));
    steps.forEach((step, i) => { step.hidden = i !== currentStep; });
    form.dataset.currentStep = String(currentStep);
    $('.step-label').textContent = stepLabels[currentStep];
    document.querySelectorAll('.step-dots i').forEach((dot, i) => dot.classList.toggle('active', i <= currentStep));
    if (focus) {
      const legend = steps[currentStep].querySelector('legend');
      legend.tabIndex = -1; legend.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
    }
  };
  const nextStep = () => {
    const invalid = Array.from(steps[currentStep].querySelectorAll('input')).find(input => !input.disabled && !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    showStep(currentStep + 1);
  };
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', nextStep));
  document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(currentStep - 1)));
  form.addEventListener('invalid', event => {
    const step = event.target.closest('[data-step]');
    if (step && Number(step.dataset.step) !== currentStep) showStep(Number(step.dataset.step), false);
  }, true);
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && currentStep < steps.length - 1 && event.target.tagName === 'INPUT') {
      event.preventDefault(); nextStep();
    }
  });
  showStep(0, false);

  const partner = $('#partnerName');
  $('#hasPartner').addEventListener('change', event => {
    const checked = event.target.checked;
    $('#partner-field').hidden = !checked; partner.disabled = !checked; partner.required = checked;
    if (checked) partner.focus(); else partner.value = '';
  });
  const endpoint = config.sheetsEndpoint;
  const connected = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
  $('#preview-note').hidden = connected;
  let activeRequest = null;
  let retryRequest = null;
  let timer;
  let pending = false;
  form.addEventListener('input', () => { if (!pending) retryRequest = null; });
  const button = $('#submit-response');
  const showError = message => {
    $('#form-error').textContent = message; $('#form-error').hidden = false;
    pending = false; button.disabled = false; button.firstElementChild.textContent = 'Try again';
  };
  const showSuccess = preview => {
    clearTimeout(timer); pending = false; activeRequest = null; retryRequest = null;
    form.hidden = true; $('#success').hidden = false;
    $('#success-eyebrow').textContent = preview ? 'A LITTLE DRESS REHEARSAL' : 'SEALED WITH LOVE';
    $('#success-title').textContent = preview ? 'Looks lovely on you.' : 'You’re part of our story.';
    $('#success-copy').textContent = preview ? 'This is a preview. Nothing has been sent or saved. Once the Google Sheet is connected, your guests’ responses will appear there.' : 'Your details have been saved. We can’t wait to celebrate this next chapter with you.';
    $('#edit-response').firstChild.textContent = preview ? 'Back to the preview ' : 'Send another response ';
    $('#success').focus({ preventScroll: true });
    $('#success').scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'center' });
  };
  form.addEventListener('submit', event => {
    if (pending) { event.preventDefault(); return; }
    $('#form-error').hidden = true;
    if (!connected) { event.preventDefault(); showSuccess(true); return; }
    activeRequest = retryRequest || crypto.randomUUID();
    retryRequest = activeRequest;
    $('#requestId').value = activeRequest;
    form.action = endpoint;
    pending = true; button.disabled = true; button.firstElementChild.textContent = 'Sending a little love…';
    timer = setTimeout(() => {
      activeRequest = null;
      showError('We couldn’t confirm your response. Please try again — we’ll avoid adding it twice if it already arrived.');
    }, 35000);
    // A native POST targets the hidden iframe. Only a verified Google reply marks it as saved.
  });
  window.addEventListener('message', event => {
    const trusted = event.origin === 'https://script.google.com' || event.origin === 'https://script.googleusercontent.com' || /^https:\/\/[a-z0-9-]+\.script\.googleusercontent\.com$/.test(event.origin) || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin);
    if (!trusted || !pending || !activeRequest || event.data?.type !== 'wedding-response' || event.data.requestId !== activeRequest) return;
    clearTimeout(timer);
    if (event.data.ok === true) showSuccess(false);
    else { activeRequest = null; retryRequest = null; showError('Your details weren’t saved. Please try again in a moment.'); }
  });
  $('#edit-response').addEventListener('click', () => {
    showStep(0, false); form.reset(); $('#partner-field').hidden = true; partner.disabled = true; partner.required = false;
    $('#success').hidden = true; form.hidden = false; $('#form-error').hidden = true;
    button.disabled = false; button.firstElementChild.textContent = 'Send with love'; $('#firstName').focus();
  });
})();
