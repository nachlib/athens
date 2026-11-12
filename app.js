/* Trip PWA | לוגיקה גנרית. כל התוכן והטקסטים מגיעים מ-trip.json */
'use strict';
fetch('./trip.json?v=5').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(start).catch(() => {
  document.getElementById('hero').textContent = 'Failed to load trip.json';
});
function start(DATA) {
  const TRIP = DATA.trip, P = DATA.places, IMAGES = DATA.images, STEPS = DATA.steps, INFO = DATA.info, UI = DATA.ui;
  const RESV = DATA.reservations || [];
  const T = (k, v) => String(UI[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => (v && n in v) ? v[n] : m);
  const STORE = TRIP.id + '.v1';
  const SIM = TRIP.id + '.sim';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  document.documentElement.lang = TRIP.lang || 'he';
  document.documentElement.dir = TRIP.dir || 'rtl';


  /* ── מצב ── */
  let state = load();
  function load() {
    try { return Object.assign({ done: {}, skipped: {} }, JSON.parse(localStorage.getItem(STORE) || '{}')); }
    catch (e) { return { done: {}, skipped: {} }; }
  }
  function save() { localStorage.setItem(STORE, JSON.stringify(state)); }

  /* ── זמן אתונה ── */
  function simNow() {
    const q = new URLSearchParams(location.search).get('now');
    const v = q || sessionStorage.getItem(SIM);
    if (!v) return null;
    const d = new Date(v.length <= 16 ? v + ':00' + TRIP.tz : v);
    return isNaN(d) ? null : d;
  }
  function now() { return simNow() || new Date(); }
  function at(day, hm) { return new Date(TRIP.days[day].date + 'T' + hm + ':00' + TRIP.tz); }
  const fmtAth = new Intl.DateTimeFormat('he-IL', { timeZone: TRIP.timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDay = new Intl.DateTimeFormat('he-IL', { timeZone: TRIP.timeZone, weekday: 'long', day: 'numeric', month: 'numeric' });
  function hm(d) { return fmtAth.format(d); }

  STEPS.forEach((s, i) => { s.idx = i; s.S = at(s.day, s.start); s.E = at(s.day, s.end); });
  const DAY_KEYS = Object.keys(TRIP.days);

  function isDone(s) { return !!state.done[s.id]; }
  function isSkipped(s) { return !!state.skipped[s.id]; }
  function isClosed(s) { return isDone(s) || isSkipped(s); }
  function currentStep() {
    // שלב אופציונלי שלא סומן לא חוסם אחרי שהשלב הבא שאינו אופציונלי כבר התחיל (בלי כתיבה למצב השמור)
    const n = now();
    return STEPS.find(s => {
      if (isClosed(s)) return false;
      if (s.optional) {
        const nx = STEPS.slice(s.idx + 1).find(x => !x.optional);
        if (nx && n >= nx.S) return false;
      }
      return true;
    }) || null;
  }
  function clockStep(n) {
    // השלב שאמור להתקיים עכשיו לפי הלו״ז
    let c = null;
    for (const s of STEPS) { if (s.optional) continue; if (s.S <= n) c = s; }
    return c;
  }
  function mins(a, b) { return Math.round((a - b) / 60000); }
  function dur(m) {
    m = Math.abs(m);
    if (m < 60) return T('min', { m });
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return r ? T('hoursMin', { h, m: r }) : T('hours', { h });
    const d = Math.floor(h / 24), hh = h % 24;
    return hh ? T('daysHours', { d, h: hh }) : T('days', { d });
  }

  /* ── טקסט בטוח + בידוד לטיני/יווני ── */
  function esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function tr(s, e) { return `<span dir="ltr" class="ltr">${s}–${e}</span>`; }
  function bidi(t) {
    const keep = [];
    let s = esc(t).replace(/→/g, '←')
      .replace(/€?\d(?:[\d:.,]*\d)?\s?[–-]\s?€?\d(?:[\d:.,]*\d)?/g, m => { keep.push(m); return '\u0001' + (keep.length - 1) + '\u0002'; });
    s = s.replace(/([A-Za-z\u0370-\u03FF\u1F00-\u1FFF€][A-Za-z0-9\u0370-\u03FF\u1F00-\u1FFF€.'’&;:\/\-–+· ]*[A-Za-z0-9\u0370-\u03FF\u1F00-\u1FFF.])/g, '<bdi>$1</bdi>');
    return s.replace(/\u0001(\d+)\u0002/g, (m, i) => `<span dir="ltr" class="ltr">${keep[+i]}</span>`);
  }


  /* ── קישורי מפות ── */
  function gdir(o) {
    const p = new URLSearchParams({ api: '1' });
    if (o.origin) p.set('origin', o.origin);
    p.set('destination', o.destination);
    if (o.waypoints && o.waypoints.length) p.set('waypoints', o.waypoints.join('|'));
    p.set('travelmode', o.type === 'transit' ? 'transit' : (o.mode || 'walking'));
    return 'https://www.google.com/maps/dir/?' + p.toString();
  }
  function gsearch(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function navIcon(t) { return t === 'route' ? '🗺️' : t === 'transit' ? '🚇' : '🧭'; }

  /* ── תמונות Wikimedia (נתיב hash מחושב מראש ב-trip.json) ── */
  function wmEnc(n) { return encodeURIComponent(n).replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2C/g, ',').replace(/%21/g, '!'); }
  function imgUrl(key, w) {
    const im = IMAGES[key]; if (!im) return null;
    const n = im.file.replace(/ /g, '_'), e = wmEnc(n);
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${im.p}/${e}/${w || im.w}px-${e}`;
  }
  function commonsPage(key) { return 'https://commons.wikimedia.org/wiki/File:' + wmEnc(IMAGES[key].file.replace(/ /g, '_')); }
  window.__imgFail = function (img) {
    const tries = +(img.dataset.t || 0);
    if (tries === 0 && img.dataset.k && IMAGES[img.dataset.k].w !== 500) { img.dataset.t = 1; img.src = imgUrl(img.dataset.k, 500); return; }
    // גיבוי: אם השרת לא מחזיר כותרת CORS, טוענים בלי crossorigin (התמונה תוצג, אבל לא תישמר לאופליין)
    if (tries <= 1 && img.hasAttribute('crossorigin') && img.dataset.k) { img.dataset.t = 2; img.removeAttribute('crossorigin'); img.src = imgUrl(img.dataset.k); return; }
    img.remove();
  };

  /* ── רינדור כרטיס ── */
  function stepHTML(s) {
    const done = isDone(s), skip = isSkipped(s);
    const tags = (s.optional ? `<span class="tag opt">${T('tagOptional')}</span>` : '') + (s.highlight ? `<span class="tag star">${T('tagHighlight')}</span>` : '');
    const media = s.img
      ? `<div class="media"><img loading="lazy" decoding="async" crossorigin="anonymous" alt="" data-k="${s.img}" src="${imgUrl(s.img)}" onerror="__imgFail(this)"><div class="ph">${s.emoji}</div><span class="credit">${esc(IMAGES[s.img].credit)}</span></div>`
      : '';
    const lines = s.transit ? `<div class="lines">${s.transit.map(l =>
      `<div class="line"><span class="badge" style="background:${l.color}"><bdi>${esc(l.line)}</bdi></span><span class="dir">${T('lineDir', { dir: `<bdi>${esc(l.dir)}</bdi>`, off: `<bdi>${esc(l.off)}</bdi>` })}</span></div>`).join('')}</div>` : '';
    const stops = s.stops ? `<div class="stops">${s.stops.map(x => `<span class="s">${bidi(x)}</span>`).join('<span class="arr">←</span>')}</div>` : '';
    const tips = s.tips ? `<div class="box tip"><ul>${s.tips.map(t => `<li>💡 ${bidi(t)}</li>`).join('')}</ul></div>` : '';
    const warn = s.warn ? `<div class="box warn"><ul>${s.warn.map(t => `<li>⚠️ ${bidi(t)}</li>`).join('')}</ul></div>` : '';
    const say = s.say ? `<div class="box say">${T('say')} <code>${esc(s.say)}</code></div>` : '';
    let acts = '';
    if (s.nav) {
      acts += `<a class="btn primary" href="${gdir(s.nav)}" target="_blank" rel="noopener">${navIcon(s.nav.type)} ${esc(s.nav.label)}</a>`;
      if (s.nav.type === 'dest') acts += `<a class="btn ghost small" href="${gsearch(s.nav.destination)}" target="_blank" rel="noopener">${T('showMap')}</a>`;
      if (s.alt) acts += `<a class="btn ghost small" href="${s.alt.type === 'transit' ? gdir(s.alt) : gdir({ destination: s.alt.destination, mode: 'walking' })}" target="_blank" rel="noopener">↪️ ${esc(s.alt.label)}</a>`;
    }
    if (s.optional) acts += `<button type="button" class="btn ghost small" data-skip="${s.id}">${skip ? T('unskip') : T('skip')}</button>`;
    return `<div class="stepwrap" data-w="${s.id}"><span class="dot"></span>
      <article class="step${done ? ' done' : ''}${skip ? ' skipped' : ''}" id="step-${s.id}">
        ${media}
        <div class="body">
          <div class="head">
            <div class="em">${s.emoji}</div>
            <div class="ttl" data-toggle="${s.id}">
              <div class="tm">${tr(s.start, s.end)}</div>
              <h3>${bidi(s.title)}${tags}</h3>
              <div class="sub">${bidi(s.sub || '')}</div>
            </div>
            <button class="check${skip ? ' skip-on' : ''}" data-check="${s.id}" aria-pressed="${done}" aria-label="${esc(T('checkAria', { title: s.title }))}">${skip ? '⏭' : '✓'}</button>
          </div>
          <div class="more">
            <p class="txt">${bidi(s.text)}</p>
            ${lines}${stops}${say}${tips}${warn}
            <div class="acts">${acts}</div>
            ${!s.nav ? `<div class="empty-nav">${T('noNav')}</div>` : ''}
          </div>
        </div>
      </article></div>`;
  }


  function renderDays() {
    for (const dk of DAY_KEYS) {
      const el = $('#day-' + dk); const d = TRIP.days[dk];
      const list = STEPS.filter(s => s.day === dk);
      el.innerHTML = `<div class="dayhead"><div><h2>${d.full}</h2><p>${d.theme}</p></div><span class="cnt" id="cnt-${dk}"></span></div>
        <div class="weather">${(d.weather || []).map(w => `<span>${w}</span>`).join('')}</div>
        <div class="tl">${list.map(stepHTML).join('')}</div>`;
    }
  }

  /* ── סטטוס בכותרת ובכרטיס הראשי ── */
  function renderStatus() {
    const n = now();
    $('#clock').textContent = hm(n);
    $('#clockday').textContent = fmtDay.format(n);
    document.body.classList.toggle('sim', !!simNow());

    const cur = currentStep();
    // סימון נוכחי בציר הזמן
    $$('.stepwrap').forEach(w => {
      const s = STEPS.find(x => x.id === w.dataset.w);
      w.classList.toggle('is-done', isDone(s));
      w.classList.toggle('is-skipped', isSkipped(s));
      w.classList.toggle('is-current', cur && s.id === cur.id);
      const art = $('article', w);
      art.classList.toggle('current', !!(cur && s.id === cur.id));
      const here = $('.here', art);
      if (cur && s.id === cur.id) { if (!here) art.insertAdjacentHTML('afterbegin', `<span class="here">${T('here')}</span>`); }
      else if (here) here.remove();
    });
    // ספירה לכל יום
    for (const dk of DAY_KEYS) {
      const list = STEPS.filter(s => s.day === dk && !s.optional);
      const c = list.filter(isClosed).length;
      $('#cnt-' + dk).textContent = T('dayCount', { c, n: list.length });
      $('#bc-' + dk).textContent = `${c}/${list.length}`;
      $('#bl-' + dk).hidden = !(cur && cur.day === dk);
    }

    const hs = $('#hstatus');
    if (cur && (n >= STEPS[0].S || Object.keys(state.done).length)) {
      const lateM = n > cur.E ? mins(n, cur.E) : 0;
      hs.innerHTML = `📍 ${bidi(cur.title)}` + (lateM >= 5 ? ` · <b class="hl">+${dur(lateM)}</b>` : (n >= cur.S ? ` · <b class="ho">${T('onTime')}</b>` : ''));
    } else hs.textContent = TRIP.subtitle;
    const hero = $('#hero');
    if (!cur) {
      hero.innerHTML = `<div class="in"><div class="kicker"><span class="pill ok">${T('doneAll')}</span></div><h2>${T('doneTitle')}</h2><div class="hsub">${T('doneSub')}</div></div>`;
      return;
    }
    const bgUrl = cur.img ? imgUrl(cur.img) : '';
    const dayList = STEPS.filter(s => s.day === cur.day && !s.optional);
    const pct = Math.round(100 * dayList.filter(isClosed).length / dayList.length);
    const nextS = STEPS.slice(cur.idx + 1).find(s => !isClosed(s));
    const first = STEPS[0];

    let pill = '', note = '', noteCls = '';
    if (n < first.S && !Object.keys(state.done).length) {
      pill = `<span class="pill soon">${T('startsIn', { x: dur(mins(first.S, n)) })}</span>`;
    } else if (n < cur.S) {
      pill = `<span class="pill early">${T('plannedAt', { t: cur.start, x: dur(mins(cur.S, n)) })}</span>`;
    } else if (n <= cur.E) {
      pill = `<span class="pill ok">${T('onTimeLeft', { x: dur(mins(cur.E, n)) })}</span>`;
    } else {
      const late = mins(n, cur.E);
      pill = `<span class="pill late">${T('late', { x: dur(late) })}</span>`;
      const hl = STEPS.find(s => s.day === cur.day && s.highlight && s.idx > cur.idx);
      if (hl && late >= 15 && !TRIP.days[cur.day].anchors) {
        note = T('shorten', { title: bidi(hl.title), t: hl.start, opt: STEPS.some(s => s.optional && s.idx > cur.idx && s.idx < hl.idx && !isClosed(s)) ? T('shortenOpt') : '' });
        noteCls = ' alert';
      } else if (late >= 20) {
        const opt = STEPS.find(s => s.optional && s.idx > cur.idx && s.day === cur.day && !isClosed(s));
        note = opt ? T('canSkip', { title: bidi(opt.title) }) : T('canShorten');
      }
    }
    // הודעות עוגן (שקיעה) לפי השעה מול זמני הפסגה והשקיעה, לא לפי סוף השלב הקודם
    const anc = TRIP.days[cur.day].anchors;
    const target = anc && STEPS.find(s => s.id === anc.step);
    if (target && cur.idx < target.idx) {
      const sunset = at(cur.day, anc.sunset);
      const between = STEPS.filter(s => s.idx > cur.idx && s.idx < target.idx && !isClosed(s));
      const ffBtn = (between.length && n >= new Date(target.S - 20 * 60000) && n < sunset)
        ? `<button type="button" class="hbtn nav" style="width:100%;margin-top:8px;min-height:42px" data-ff="${target.id}">${esc(anc.ffLabel)}</button>` : '';
      const fill = (tpl, x, t) => esc(tpl).replace('{x}', x).replace('{t}', t);
      if (n < target.S) {
        note = fill(anc.msgBefore, dur(mins(target.S, n)), target.start) + ffBtn;
        noteCls = ffBtn ? ' alert' : '';
      } else if (n < sunset) {
        note = fill(anc.msgBeforeSunset, dur(mins(sunset, n)), anc.sunset) + ffBtn;
        noteCls = ' alert';
      } else {
        note = esc(anc.msgAfterSunset);
        noteCls = '';
      }
    }
    const byClock = clockStep(n);
    const clockLine = (byClock && byClock.id !== cur.id && n >= first.S && n <= STEPS[STEPS.length - 1].E)
      ? `<button class="bycl" data-jump="${byClock.id}">${T('byClock', { title: bidi(byClock.title), t: byClock.start })}</button>` : '';

    const navBtn = cur.nav ? `<a class="hbtn nav${cur.optional ? '' : ' full'}" href="${gdir(cur.nav)}" target="_blank" rel="noopener">${navIcon(cur.nav.type)} ${esc(cur.nav.label)}</a>` : '';
    hero.innerHTML = `
      ${bgUrl ? `<div class="bg" style="background-image:url('${bgUrl}')"></div>` : ''}<div class="shade"></div>
      <div class="in">
        <div class="kicker"><span class="pill">${TRIP.days[cur.day].full}</span>${pill}</div>
        <h2>${cur.emoji} ${bidi(cur.title)}</h2>
        <div class="hsub">${bidi(cur.sub || '')}</div>
        <div class="htime">🕒 ${tr(cur.start, cur.end)}</div>
        ${note ? `<div class="hnote${noteCls}">${note}</div>` : ''}
        ${clockLine}
        <div class="acts">
          ${navBtn}
          ${cur.optional ? `<button type="button" class="hbtn skip" data-skip="${cur.id}">${T('skip')}</button>` : ''}
          <button type="button" class="hbtn done full" data-check="${cur.id}">${STEPS.some(s => s.idx > cur.idx && isSkipped(s) && !s.optional) ? T('doneHere') : T('doneNext')}</button>
        </div>
        ${nextS ? `<div class="next" data-jump="${nextS.id}">⬅️ <span>${T('next')} <b>${bidi(nextS.title)}</b> · <span dir="ltr">${nextS.start}</span>${nextS.day !== cur.day ? ' (' + TRIP.days[nextS.day].label + ')' : ''}</span></div>` : ''}
        <div class="progress"><div class="bar"><i style="width:${pct}%"></i></div><div class="lbl"><span>${T('progress', { day: TRIP.days[cur.day].label, p: pct })}</span><span>${T('stepOf', { i: Math.min(dayList.filter(isClosed).length + 1, dayList.length), n: dayList.length })}</span></div></div>
      </div>`;
  }

  /* ── טאבים ── */
  let tab = null;
  function showTab(t, scrollTo) {
    tab = t;
    $$('.view').forEach(v => v.hidden = v.id !== 'day-' + t && v.id !== t);
    $('#hero').hidden = t === 'info';
    $$('.bnav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    if (scrollTo) setTimeout(() => { const el = $('#step-' + scrollTo); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    else window.scrollTo({ top: 0, behavior: 'auto' });
    updateFab();
  }
  function jumpTo(id) { const s = STEPS.find(x => x.id === id); if (s) showTab(s.day, id); }
  function goCurrent() { const c = currentStep(); if (c) jumpTo(c.id); }

  function updateFab() {
    const c = currentStep(); const fab = $('#fab');
    if (!c || tab === 'info') { fab.classList.remove('show'); return; }
    const el = $('#step-' + c.id);
    if (tab !== c.day) { fab.classList.add('show'); fab.textContent = T('fabDay', { day: TRIP.days[c.day].label }); return; }
    const r = el.getBoundingClientRect();
    const vis = r.bottom > 90 && r.top < innerHeight - 80;
    fab.classList.toggle('show', !vis); fab.textContent = T('fab');
  }

  /* ── פעולות ── */
  function toast(msg, action, label) {
    const t = $('#toast'); t.innerHTML = `<span>${msg}</span>` + (action ? `<button type="button" id="undo">${esc(label || T('undo'))}</button>` : '');
    t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 4500);
    if (action) $('#undo').onclick = () => { action(); t.classList.remove('show'); };
  }
  function toggleDone(id) {
    const s = STEPS.find(x => x.id === id);
    if (state.done[id]) { delete state.done[id]; }
    else { state.done[id] = Date.now(); delete state.skipped[id]; if (navigator.vibrate) navigator.vibrate(18); }
    save(); refreshStep(s);
    if (state.done[id]) toast('✓ ' + esc(s.title), () => { delete state.done[id]; save(); refreshStep(s); });
  }
  function toggleSkip(id) {
    const s = STEPS.find(x => x.id === id);
    if (state.skipped[id]) delete state.skipped[id]; else { state.skipped[id] = true; delete state.done[id]; }
    save(); refreshStep(s);
  }
  function fastForward(targetId) {
    const hl = STEPS.find(x => x.id === targetId), c = currentStep();
    if (!hl || !c) return;
    const snap = JSON.stringify(state);
    let count = 0;
    STEPS.forEach(s => { if (s.idx > c.idx && s.idx < hl.idx && !isClosed(s)) { state.skipped[s.id] = true; count++; } });
    if (!count) return;
    save(); renderDays(); renderStatus(); showTab(hl.day, hl.id);
    toast(T('ffDone', { n: count }), () => {
      state = JSON.parse(snap); save(); renderDays(); renderStatus(); updateFab();
    }, T('ffUndo'));
  }
  function refreshStep(s) {
    const before = tab;
    const w = $(`.stepwrap[data-w="${s.id}"]`);
    const tmp = document.createElement('div'); tmp.innerHTML = stepHTML(s);
    w.replaceWith(tmp.firstElementChild);
    renderStatus();
    const c = currentStep();
    if (c && before !== 'info' && before !== c.day && isClosed(s)) showTab(c.day, c.id);
    updateFab();
  }

  document.addEventListener('click', e => {
    const ra = e.target.closest('[data-res-act]'); if (ra) { e.preventDefault(); resAction(ra.dataset.resAct, ra.dataset.res); return; }
    const c = e.target.closest('[data-check]'); if (c) { e.preventDefault(); toggleDone(c.dataset.check); return; }
    const k = e.target.closest('[data-skip]'); if (k) { e.preventDefault(); toggleSkip(k.dataset.skip); return; }
    const f = e.target.closest('[data-ff]');
    if (f) { fastForward(f.dataset.ff); return; }
    const j = e.target.closest('[data-jump]'); if (j) { jumpTo(j.dataset.jump); return; }
    const t = e.target.closest('[data-toggle]');
    if (t) { const a = $('#step-' + t.dataset.toggle); if (a.classList.contains('done') || a.classList.contains('skipped')) a.classList.toggle('open'); return; }
    const b = e.target.closest('.bnav button'); if (b) { showTab(b.dataset.tab, b.dataset.tab !== 'info' && currentStep() && currentStep().day === b.dataset.tab ? currentStep().id : null); return; }
  });
  $('#fab').addEventListener('click', goCurrent);
  addEventListener('scroll', () => { cancelAnimationFrame(updateFab.r); updateFab.r = requestAnimationFrame(updateFab); }, { passive: true });

  /* ── מידע: סימולציה, איפוס, אופליין ── */
  function initInfo() {
    const inp = $('#simInput');
    const cur = sessionStorage.getItem(SIM); if (cur) inp.value = cur;
    $('#simOn').onclick = () => { if (!inp.value) return; sessionStorage.setItem(SIM, inp.value); renderStatus(); toast(T('simActive')); };
    $('#simOff').onclick = () => { sessionStorage.removeItem(SIM); inp.value = ''; renderStatus(); toast(T('simReal')); };
    $('#resetAll').onclick = () => {
      if (!confirm(T('resetConfirm'))) return;
      state = { done: {}, skipped: {} }; save(); renderDays(); renderStatus(); toast(T('resetDone'));
    };
    $('#cacheImgs').onclick = async () => {
      const keys = Object.keys(IMAGES); let ok = 0;
      $('#cacheMsg').textContent = T('caching');
      await Promise.all(keys.map(k => fetch(imgUrl(k)).then(r => { if (r.ok) ok++; }).catch(() => {})));
      $('#cacheMsg').textContent = T('cached', { ok, n: keys.length });
    };
    $('#credits').innerHTML = Object.keys(IMAGES).map(k => `<a href="${commonsPage(k)}" target="_blank" rel="noopener">${esc(IMAGES[k].file)}</a> · ${esc(IMAGES[k].credit)}`).join('<br>');
  }


  /* ── מסך מידע מתוך trip.json ── */
  const byId = id => STEPS.find(s => s.id === id);
  const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  // תבניות: {s:id.field} שלב · {t:path} trip · {d:day.path} יום · {map:KEY} קישור מפה · {code:id} קוד מוסתר
  function tpl(str) {
    return String(str).replace(/\{(s|t|d|map|code):([\w.]+)\}/g, (m, kind, path) => {
      if (kind === 's') { const [id, ...f] = path.split('.'); const st = byId(id); const v = st && getPath(st, f.join('.')); return v == null ? '' : esc(v); }
      if (kind === 't') { const v = getPath(TRIP, path); return v == null ? '' : esc(v); }
      if (kind === 'd') { const v = getPath(TRIP.days, path); return v == null ? '' : esc(v); }
      if (kind === 'map') return P[path] ? `<a href="${gsearch(P[path])}" target="_blank" rel="noopener">${T('mapLink')}</a>` : '';
      if (kind === 'code') return `<span data-code-slot="${path}"></span>`;
      return m;
    });
  }
  function infoCard(c, body) {
    return `<div class="card" data-info="${c.type}"><h3>${c.icon || ''} ${esc(c.title)}</h3>${body}</div>`;
  }
  const muted = t => `<p style="font-size:12.5px;color:var(--muted);margin:6px 0 0">${t}</p>`;
  function renderInfo() {
    $('#infoContent').innerHTML = INFO.map(c => {
      let body = '';
      if (c.type === 'list') body = `<ul>${c.items.map(i => `<li>${tpl(i)}</li>`).join('')}</ul>`;
      else if (c.type === 'table') body = `<table>${c.rows.map(r => `<tr><td>${tpl(r[0])}</td><td>${tpl(r[1])}</td></tr>`).join('')}</table>`;
      else if (c.type === 'emergency') body = `<ul>${c.rows.map(r => `<li>${esc(r[0])}: <a href="tel:${esc(r[1])}"><b>${esc(r[1])}</b></a></li>`).join('')}</ul>`;
      else if (c.type === 'reservations') body = `<div id="resBox"></div>`;
      else return '';
      if (c.warn) body += `<div class="box warn" style="margin-top:8px">⚠️ ${tpl(c.warn)}</div>`;
      if (c.note) body += muted(tpl(c.note));
      return infoCard(c, body);
    }).join('');
    renderRes();
  }

  /* ── ההזמנות שלנו: קודים פרטיים, נשמרים רק ב-localStorage של המכשיר ── */
  const RES = Object.fromEntries(RESV.map(r => [r.id, Object.assign({}, r, { key: TRIP.id + '.' + r.storageKey })]));
  const resView = Object.fromEntries(RESV.map(r => [r.id, false]));
  let resEdit = null;
  function getCode(k) { try { return localStorage.getItem(RES[k].key) || ''; } catch (e) { return ''; } }
  function mask(c) { return c.length <= 3 ? '•'.repeat(c.length) : '•'.repeat(c.length - 3) + c.slice(-3); }
  function codeSpan(k) {
    const c = RES[k] ? getCode(k) : '';
    return c ? `<bdi dir="ltr" class="code">${esc(resView[k] ? c : mask(c))}</bdi>` : `<span class="code-empty">${T('codeEmpty')}</span>`;
  }
  function resCardHTML(k) {
    const r = RES[k], c = getCode(k);
    const head = r.name ? `<div class="res-name"><bdi>${esc(r.name)}</bdi></div>${r.address ? `<div class="res-sub"><bdi>${esc(r.address)}</bdi></div>` : ''}` : '';
    const expl = r.note ? `<div class="res-sub">${esc(r.note)}</div>` : '';
    let body;
    if (resEdit === k) {
      body = `<form class="res-form" data-res-form="${k}">
          <label for="res-in-${k}" class="res-lbl">${esc(r.label)}</label>
          <input id="res-in-${k}" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" dir="ltr" maxlength="20" placeholder="${esc(T('codePlaceholder'))}">
          <div class="res-acts">
            <button type="submit" class="btn primary small">${T('save')}</button>
            <button type="button" class="btn ghost small" data-res-act="cancel" data-res="${k}">${T('cancel')}</button>
          </div>
          <div class="res-err" aria-live="polite"></div>
        </form>`;
    } else {
      const w = { what: r.aria };
      const acts = c
        ? `<button type="button" class="btn ghost small" data-res-act="${resView[k] ? 'hide' : 'show'}" data-res="${k}" aria-label="${esc(T(resView[k] ? 'hideAria' : 'showAria', w))}">${T(resView[k] ? 'hide' : 'show')}</button>
           <button type="button" class="btn ghost small" data-res-act="copy" data-res="${k}" aria-label="${esc(T('copyAria', w))}">${T('copy')}</button>
           <button type="button" class="btn ghost small" data-res-act="edit" data-res="${k}" aria-label="${esc(T('editAria', w))}">${T('edit')}</button>`
        : `<button type="button" class="btn ghost small" data-res-act="edit" data-res="${k}" aria-label="${esc(T('enterAria', w))}">${T('enter')}</button>`;
      const nav = r.nav ? `<a class="btn ghost small" href="${gdir({ destination: r.nav.destination, mode: 'walking' })}" target="_blank" rel="noopener">${esc(r.nav.label)}</a>` : '';
      body = `<div class="res-lbl">${esc(r.label)}</div><div class="res-code">${codeSpan(k)}</div><div class="res-acts">${acts}${nav}</div>`;
    }
    return `<div class="res-card" data-res-card="${k}">${head}${body}${expl}</div>`;
  }
  function renderRes() {
    const box = $('#resBox');
    if (box) {
      const any = RESV.some(r => getCode(r.id));
      box.innerHTML = RESV.map(r => resCardHTML(r.id)).join('') + `<p class="res-note">${T('resNote')}</p>` +
        (any ? `<button type="button" class="btn ghost small res-wipe" data-res-act="wipe" aria-label="${esc(T('wipe'))}">${T('wipe')}</button>` : '');
      if (resEdit) { const i = $('#res-in-' + resEdit); if (i) i.focus(); }
    }
    $$('[data-code-slot]').forEach(el => { el.innerHTML = codeSpan(el.dataset.codeSlot); });
  }
  async function copyCode(k) {
    const c = getCode(k); if (!c) return;
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(c); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = c; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.value = ''; ta.remove();
    }
    toast(ok ? RES[k].copied : T('copyFail'));
  }
  function resAction(act, k) {
    if (act === 'show') { resView[k] = true; renderRes(); }
    else if (act === 'hide') { resView[k] = false; renderRes(); }
    else if (act === 'copy') copyCode(k);
    else if (act === 'edit') { resEdit = k; resView[k] = false; renderRes(); }
    else if (act === 'cancel') { resEdit = null; renderRes(); }
    else if (act === 'wipe') {
      if (!confirm(T('wipeConfirm'))) return;
      Object.values(RES).forEach(r => { try { localStorage.removeItem(r.key); } catch (e) {} });
      Object.keys(resView).forEach(x => resView[x] = false); resEdit = null; renderRes(); toast(T('wiped'));
    }
  }
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-res-form]'); if (!f) return;
    e.preventDefault();
    const k = f.dataset.resForm, inp = $('input', f);
    const v = (inp.value || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(v)) { $('.res-err', f).textContent = T('invalidCode'); return; }
    try { localStorage.setItem(RES[k].key, v); } catch (er) { $('.res-err', f).textContent = T('saveFail'); return; }
    inp.value = ''; resEdit = null; renderRes(); toast(T('saved'));
  });

  /* ── התקנה ── */
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#install').style.display = 'block'; });
  $('#install').addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('#install').style.display = 'none'; });

  /* ── Service Worker ── */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) toast(T('newVersion'), () => { nw.postMessage('skip'); }, T('update'));
        });
      });
    }).catch(() => {});
    // רענון רק כשגרסה חדשה מחליפה גרסה קיימת, ולא בהתקנה הראשונה
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  }

  /* ── בניית המעטפת: כותרת, ימים, ניווט ומסך מידע מתוך trip.json ── */
  function buildShell() {
    $('#htitle').textContent = TRIP.title;
    $('#clockday').textContent = TRIP.clockLabel || '';
    document.title = `${TRIP.title} ${TRIP.subtitle} | ${TRIP.appName}`;
    $('#simRibbon').textContent = T('simRibbon');
    $('#install').textContent = T('install');
    $('#fab').textContent = T('fab');
    $('#bnav').setAttribute('aria-label', T('navAria'));
    $('#main').insertAdjacentHTML('beforeend', DAY_KEYS.map(dk => `<section class="view" id="day-${dk}" hidden></section>`).join('') + `
      <section class="view info" id="info" hidden>
        <div class="dayhead"><div><h2>${T('infoTitle')}</h2><p>${T('infoSub')}</p></div></div>
        <div id="infoContent"></div>
        <div class="card">
          <h3>${T('offlineTitle')}</h3>
          <p>${T('offlineText')}</p>
          <div class="row"><button type="button" class="btn primary" id="cacheImgs">${T('cacheBtn')}</button></div>
          <p id="cacheMsg" style="font-size:13px;color:var(--muted)"></p>
          <p style="font-size:13px;color:var(--muted)">${T('installHelp')}</p>
        </div>
        <div class="card">
          <h3>${T('simTitle')}</h3>
          <p>${T('simText')}</p>
          <input type="datetime-local" id="simInput" min="${TRIP.days[DAY_KEYS[0]].date}T00:00" max="${TRIP.days[DAY_KEYS[DAY_KEYS.length - 1]].date}T23:59">
          <div class="row">
            <button type="button" class="btn primary small" id="simOn" style="flex:1">${T('simOn')}</button>
            <button type="button" class="btn ghost small" id="simOff" style="flex:1">${T('simOff')}</button>
          </div>
          <div class="row"><button type="button" class="btn ghost small" id="resetAll" style="flex:1">${T('resetAll')}</button></div>
        </div>
        <div class="card"><h3>${T('creditsTitle')}</h3><div class="credits" id="credits"></div></div>
      </section>`);
    const nav = $('#bnavDays');
    nav.style.gridTemplateColumns = `repeat(${DAY_KEYS.length + 1},1fr)`;
    nav.innerHTML = DAY_KEYS.map(dk => `<button type="button" data-tab="${dk}"><span class="live" id="bl-${dk}" hidden></span><span class="i">${TRIP.days[dk].icon || T('defaultDayIcon')}</span>${esc(TRIP.days[dk].label)}<span class="c" id="bc-${dk}"></span></button>`).join('') +
      `<button type="button" data-tab="info"><span class="i">${T('infoIcon')}</span>${T('infoTab')}<span class="c">&nbsp;</span></button>`;
  }

  /* ── הפעלה ── */
  buildShell();
  renderDays(); renderInfo(); initInfo(); renderStatus();
  const c0 = currentStep();
  showTab(c0 ? c0.day : DAY_KEYS[0], c0 && Object.keys(state.done).length ? c0.id : null);
  setInterval(renderStatus, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderStatus(); });
}
