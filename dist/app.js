(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const config = window.WEDDING;
  const $ = (selector) => document.querySelector(selector);
  document.querySelectorAll('[data-name]').forEach(el => { el.textContent = config.names[Number(el.dataset.name)]; });
  document.title = `${config.names.join(' & ')} — June 20, 2027`;
  $('[data-date]').textContent = config.dateLabel;
  $('[data-venue]').textContent = config.venue;
  $('[data-location]').textContent = config.location;
  if (config.time) $('[data-time]').textContent = config.time;
  if (config.registryUrl && /^https:\/\//.test(config.registryUrl)) {
    $('#registry-link').href = config.registryUrl;
    $('#registry-link').hidden = false;
    $('#registry-pending').hidden = true;
  }
  for (const [key, path] of Object.entries(config.photos)) {
    if (!path) continue;
    const holder = document.querySelector(`[data-photo="${key}"]`);
    const image = new Image();
    image.alt = `A favorite moment with ${config.names.join(' and ')}`;
    image.loading = key === 'hero' ? 'eager' : 'lazy';
    image.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0';
    image.addEventListener('load', () => { holder.replaceChildren(image); holder.removeAttribute('role'); holder.removeAttribute('aria-label'); });
    image.src = path;
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
    }, { threshold: .08 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  } else { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let framePending = false;
  const paintParallax = () => {
    framePending = false;
    document.querySelectorAll('[data-parallax]').forEach(el => {
      const rect = el.getBoundingClientRect();
      const offset = Math.max(-30, Math.min(30, (innerHeight / 2 - rect.top - rect.height / 2) * Number(el.dataset.parallax)));
      el.style.translate = motion.matches ? '0 0' : `0 ${offset}px`;
    });
  };
  window.addEventListener('scroll', () => { if (!framePending) { framePending = true; requestAnimationFrame(paintParallax); } }, { passive: true });
  motion.addEventListener('change', paintParallax);
  paintParallax();
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
    $('#success-title').textContent = preview ? 'Looks lovely on you.' : 'You’re on our list.';
    $('#success-copy').textContent = preview ? 'This is a preview. Nothing has been sent or saved. Once the Google Sheet is connected, your guests’ responses will appear there.' : 'Your details have been saved. Thank you for sharing a little love — your invitation will follow.';
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
    form.reset(); $('#partner-field').hidden = true; partner.disabled = true; partner.required = false;
    $('#success').hidden = true; form.hidden = false; $('#form-error').hidden = true;
    button.disabled = false; button.firstElementChild.textContent = 'Send with love'; $('#firstName').focus();
  });
})();
