const app = document.getElementById('app');
const toast = document.getElementById('toast');

const state = {
  route: 'welcome',
  onboarding: 1,
  connected: false,
  planView: 'day',
  recoveryAdded: false,
  selectedRecovery: 'Cosmic Drift',
  playing: false,
  elapsed: 0,
  duration: 600,
  timer: null,
  napRemaining: 1560,
  napRunning: false,
};

const icons = { plan: '▦', reset: '◉', you: '○' };

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1700);
}

function go(route) {
  clearInterval(state.timer);
  state.timer = null;
  state.playing = false;
  state.route = route;
  render();
}

function nav(active) {
  return `<nav class="bottom-nav">
    <button data-go="plan" class="${active === 'plan' ? 'active' : ''}"><b>${icons.plan}</b>Plan</button>
    <button data-go="reset" class="${active === 'reset' ? 'active' : ''}"><b>${icons.reset}</b>Recovery</button>
    <button data-go="profile" class="${active === 'profile' ? 'active' : ''}"><b>${icons.you}</b>You</button>
  </nav>`;
}

function welcome() {
  return `<section class="page center"><div class="mark">○</div><div class="eyebrow">beforeburn</div><h1>Plan your energy,<br>not just your time.</h1><p>See busy days early. Make room to recover.</p><div class="actions"><button class="primary" data-go="signup">Create account</button><button class="secondary" data-go="signin">Sign in</button><button class="text-button" data-go="calendar">Explore prototype</button></div></section>`;
}

function auth(kind) {
  const signup = kind === 'signup';
  return `<section class="page center"><button class="back" data-go="welcome">‹</button><div class="eyebrow">Account</div><h1>${signup ? 'Create your account' : 'Welcome back'}</h1><p>Your plan stays private and synced.</p><div class="field"><label>Email</label><input type="email" value="nysa@example.com"></div><div class="field"><label>Password</label><input type="password" value="prototype"></div><div class="actions"><button class="primary" data-go="calendar">${signup ? 'Create account' : 'Sign in'}</button><button class="text-button" data-go="calendar">Continue with Google</button></div></section>`;
}

function calendarConnect() {
  return `<section class="page center"><div class="progress" style="--p:25%"><i></i></div><div class="eyebrow">Setup · 1 of 4</div><h1>Bring in your schedule.</h1><p>beforeburn reads event times to find crowded days. Nothing changes without your approval.</p><div class="choice-list"><button class="choice ${state.connected ? 'selected' : ''}" data-action="connect"><span class="choice-icon">G</span><span><strong>Google Calendar</strong><small>${state.connected ? 'Connected' : 'Connect securely'}</small></span></button><button class="choice" data-action="connect"><span class="choice-icon">A</span><span><strong>Apple Calendar</strong><small>Use calendars on this device</small></span></button></div><div class="privacy">Read-only by default · Choose calendars · Disconnect anytime</div><div class="actions"><button class="primary" data-go="calendars">${state.connected ? 'Continue' : 'Connect calendar'}</button><button class="text-button" data-go="onboarding">Set up manually</button></div></section>`;
}

function calendars() {
  return `<section class="page center"><button class="back" data-go="calendar">‹</button><div class="progress" style="--p:50%"><i></i></div><div class="eyebrow">Setup · 2 of 4</div><h1>What should appear?</h1><p>Select calendars that affect your energy.</p><div class="choice-list"><button class="choice selected"><span class="check"></span><span><strong>School</strong><small>8 events this week</small></span></button><button class="choice selected"><span class="check"></span><span><strong>Personal</strong><small>4 events this week</small></span></button><button class="choice"><span class="check"></span><span><strong>Birthdays</strong><small>1 event this week</small></span></button><button class="choice selected"><span class="check"></span><span><strong>Track</strong><small>3 events this week</small></span></button></div><div class="actions"><button class="primary" data-go="onboarding">Import 15 events</button></div></section>`;
}

function onboarding() {
  const step = state.onboarding;
  const content = step === 1
    ? `<h1>What fills your week?</h1><p>Select all that apply.</p><div class="choice-list"><button class="choice selected"><span class="check"></span><strong>School or college</strong></button><button class="choice"><span class="check"></span><strong>Work</strong></button><button class="choice selected"><span class="check"></span><strong>Sports or activities</strong></button><button class="choice"><span class="check"></span><strong>Family responsibilities</strong></button></div>`
    : step === 2
      ? `<h1>When do you usually sleep?</h1><p>This helps protect recovery time.</p><div class="field"><label>Usually in bed</label><div class="fake-input">11:00 PM</div></div><div class="field"><label>Usually awake</label><div class="fake-input">7:00 AM</div></div><div class="privacy">Change this anytime. beforeburn is not a sleep or medical diagnostic tool.</div>`
      : `<h1>How is your energy today?</h1><p>There is no wrong answer.</p><div class="choice-list"><button class="choice">Very low</button><button class="choice selected">Low</button><button class="choice">Okay</button><button class="choice">Good</button><button class="choice">High</button></div>`;
  return `<section class="page center"><button class="back" data-action="onboard-back">‹</button><div class="progress" style="--p:${50 + step * 16.6}%"><i></i></div><div class="eyebrow">Setup · ${step + 2} of 5</div>${content}<div class="actions"><button class="primary" data-action="onboard-next">${step === 3 ? 'See my week' : 'Continue'}</button></div></section>`;
}

function plan() {
  let body = '';
  if (state.planView === 'day') {
    body = `<div class="date-row"><div><h3>Wednesday</h3><p>September 10</p></div><p>Today</p></div><div class="load-note"><b>A busy afternoon</b><span>Three commitments without a pause.</span></div><div class="timeline"><div class="event-row"><div class="time">8 AM</div><div class="event"><b>School</b><small>8:00–3:00</small></div></div><div class="event-row"><div class="time">3 PM</div>${state.recoveryAdded ? '<div class="event"><b>Cosmic Drift</b><small>3:15–3:30 · Recovery</small></div>' : '<button class="suggestion" data-action="suggest"><b>＋ Add a 15-minute reset</b><small>Before practice</small></button>'}</div><div class="event-row"><div class="time">4 PM</div><div class="event"><b>Track practice</b><small>4:00–5:30</small></div></div><div class="event-row"><div class="time">7 PM</div><div class="event"><b>Physics study</b><small>7:00–8:30</small></div></div><div class="event-row"><div class="time">9 PM</div><button class="suggestion" data-recovery="Cosmic Drift"><b>Start a wind-down</b><small>Cosmic Drift · 10 min</small></button></div></div>`;
  } else if (state.planView === 'week') {
    const cells = Array.from({length:35},(_,i)=>`<div class="${[3,10,17,18,24].includes(i)?'heavy':[2,4,8,9,11,16,23].includes(i)?'busy':i===26?'rest':''}"></div>`).join('');
    body = `<div class="date-row"><div><h3>September 8–14</h3><p>Your week</p></div></div><div class="load-note"><b>Wednesday needs attention</b><span>Your third demanding day in a row.</span></div><div class="week"><div></div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>${cells}</div><div class="pattern"><b>Suggested</b><br>Move SAT preparation to Thursday evening.</div>`;
  } else {
    const cells = Array.from({length:28},(_,i)=>`<div class="${[3,10,11,17,24].includes(i)?'heavy':[1,7,8,15,16,21,23].includes(i)?'medium':''}">${i+1}</div>`).join('');
    body = `<div class="date-row"><div><h3>September</h3><p>Monthly pattern</p></div></div><div class="month">${cells}</div><div class="pattern"><b>Pattern</b><br>Thursdays carry your highest load.</div>`;
  }
  return `<section class="page app-page"><div class="app-head"><div><div class="eyebrow">Good morning</div><h2>Your plan</h2></div><button class="avatar" data-go="profile">N</button></div><div class="segmented"><button data-view="day" class="${state.planView==='day'?'active':''}">Day</button><button data-view="week" class="${state.planView==='week'?'active':''}">Week</button><button data-view="month" class="${state.planView==='month'?'active':''}">Month</button></div>${body}<button class="fab" data-action="add-item">＋</button>${nav('plan')}</section>`;
}

function recovery() {
  return `<section class="page app-page"><div class="app-head"><div><div class="eyebrow">Take a moment</div><h2>Recovery</h2></div><button class="avatar" data-go="profile">N</button></div><p>Choose how you want to recover.</p><div class="recovery-list"><button class="recovery-card space-card" data-recovery="Cosmic Drift"><b>Cosmic Drift</b><span>Ambient space · breathing visual · 10 min</span></button><button class="recovery-card forest-card" data-recovery="Conscious Forest"><b>Conscious Forest</b><span>Forest sound · moving light · 10 min</span></button><button class="recovery-card chant-card" data-recovery="Chanting Sky"><b>Chanting Sky</b><span>Gentle voice · open horizon · 10 min</span></button><button class="recovery-card nap-card" data-go="nap"><b>26-minute power nap</b><span>Timer · soft wake sound · optional settle time</span></button></div>${nav('reset')}</section>`;
}

function player() {
  const name = state.selectedRecovery;
  const sceneClass = name === 'Conscious Forest' ? 'forest-scene' : name === 'Chanting Sky' ? 'chant-scene' : 'stars';
  const sub = name === 'Conscious Forest' ? 'Listen to the leaves' : name === 'Chanting Sky' ? 'Let the sound open' : 'Breathe with the light';
  const pct = Math.min(100, state.elapsed/state.duration*100);
  return `<section class="page dark"><div class="scene ${sceneClass}"></div><div class="player-content"><div class="immersive-close"><button data-go="reset">×</button><button data-action="reduce-motion">◌</button></div><div class="orb"><i></i></div><h2>${name}</h2><p>${sub}</p><div class="player"><div class="player-time"><span>${formatTime(state.elapsed)}</span><span>${formatTime(state.duration)}</span></div><div class="track" style="--track:${pct}%"><i></i></div><div class="player-controls"><button class="ghost-control" data-action="restart">Restart</button><button class="round-play" data-action="play">${state.playing?'Ⅱ':'▶'}</button><button class="ghost-control" data-action="finish">Finish</button></div></div></div></section>`;
}

function nap() {
  return `<section class="page dark"><div class="scene stars"></div><div class="player-content"><div class="immersive-close"><button data-go="reset">×</button><button data-action="nap-sound">♪</button></div><div class="orb"><i class="nap-clock">${formatTime(state.napRemaining)}</i></div><h2>Power nap</h2><p>${state.napRunning ? 'Soft wake sound is on' : '26 minutes · optional 4-minute settle time'}</p><div class="player"><div class="player-controls"><button class="ghost-control" data-action="nap-reset">Reset</button><button class="round-play" data-action="nap-play">${state.napRunning?'Ⅱ':'▶'}</button><button class="ghost-control" data-action="nap-finish">Finish</button></div><div class="nap-note">Inspired by NASA/FAA fatigue research. Not medical advice.</div></div></div></section>`;
}

function complete() {
  return `<section class="page center"><div class="mark" style="margin:90px auto 25px">✓</div><h1 style="text-align:center">Welcome back.</h1><p style="text-align:center">You made space to recover.</p><div class="field" style="margin-top:55px"><label>How do you feel now?</label><div class="durations"><button>Lower</button><button class="active">Same</button><button>Better</button></div></div><div class="actions"><button class="primary" data-go="plan">Return to my day</button><button class="text-button" data-go="reset">Choose another recovery</button></div></section>`;
}

function profile() {
  return `<section class="page app-page"><div class="app-head"><h2>You</h2></div><div class="profile-card"><div class="profile-avatar">N</div><h2>Nysa</h2><p>nysa@example.com</p></div><div class="menu"><button data-action="checkin"><span>Daily energy check-in</span><span>›</span></button><button data-action="sleep"><span>Sleep window</span><span>11 PM–7 AM ›</span></button><button data-go="profile-calendars"><span>Calendar connections</span><span>3 ›</span></button><button data-action="settings"><span>Recovery preferences</span><span>›</span></button><button data-go="notifications"><span>Notifications</span><span>›</span></button><button data-go="privacy"><span>Privacy and data</span><span>›</span></button></div>${nav('profile')}</section>`;
}

function settingsPage(type) {
  const configs = {
    'profile-calendars': ['Calendars','Choose what beforeburn can see and where recovery blocks go.',`<div class="choice-list"><div class="choice selected"><span class="choice-icon">G</span><span><strong>nysa@example.com</strong><small>Synced 2 minutes ago</small></span></div></div><div class="menu" style="margin-top:20px"><button><span>School</span><span class="switch"></span></button><button><span>Personal</span><span class="switch"></span></button><button><span>Track</span><span class="switch"></span></button></div><div class="field"><label>Add recovery blocks to</label><div class="fake-input">Personal</div></div><div class="actions"><button class="secondary" data-action="disconnect">Disconnect account</button></div>`],
    notifications: ['Notifications','Keep reminders useful and quiet.',`<div class="menu" style="margin-top:25px"><button><span>Morning plan</span><span class="switch"></span></button><button><span>Upcoming recovery</span><span class="switch"></span></button><button><span>Busy-day warning</span><span class="switch"></span></button><button><span>Weekly preview</span><span class="switch"></span></button></div><div class="privacy">No streak reminders. No repeated warning when nothing changes.</div>`],
    privacy: ['Privacy and data','Your schedule and check-ins belong to you.',`<div class="menu" style="margin-top:25px"><button><span>What beforeburn reads</span><span>›</span></button><button data-action="export"><span>Export my data</span><span>›</span></button><button data-action="delete-checkins"><span>Delete check-in history</span><span>›</span></button><button data-action="delete-account"><span>Delete account</span><span>›</span></button></div><div class="privacy">beforeburn supports planning and recovery. It does not diagnose or treat a medical condition.</div>`]
  };
  const [title, subtitle, content] = configs[type];
  return `<section class="page center"><button class="back" data-go="profile">‹</button><h1>${title}</h1><p>${subtitle}</p>${content}<div class="grow"></div></section>`;
}

function modal() {
  return `<div class="modal-shade" data-action="close-modal"><div class="sheet" role="dialog" aria-modal="true" aria-label="Add recovery"><div class="handle"></div><h2>Make room to reset?</h2><p>Add a short pause before track practice.</p><div class="durations"><button>5 min</button><button class="active">15 min</button><button>20 min</button></div><div class="mini-choice"><i></i><div><b>Cosmic Drift</b><p>Ambient sound + slow visual</p></div></div><button class="primary" data-action="confirm-recovery">Add to calendar</button><button class="text-button" data-action="close-modal">Not now</button></div></div>`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2,'0');
  const s = Math.floor(seconds % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function render() {
  const routes = {
    welcome,
    signup: () => auth('signup'),
    signin: () => auth('signin'),
    calendar: calendarConnect,
    calendars,
    onboarding,
    plan,
    reset: recovery,
    player,
    nap,
    complete,
    profile,
    'profile-calendars': () => settingsPage('profile-calendars'),
    notifications: () => settingsPage('notifications'),
    privacy: () => settingsPage('privacy'),
  };
  app.innerHTML = routes[state.route]();
  bind();
}

function bind() {
  app.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); go(el.dataset.go); }));
  app.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => { state.planView = el.dataset.view; render(); }));
  app.querySelectorAll('[data-recovery]').forEach(el => el.addEventListener('click', () => { state.selectedRecovery = el.dataset.recovery; state.elapsed = 0; go('player'); }));
  app.querySelectorAll('.choice').forEach(el => { if (!el.dataset.action) el.addEventListener('click', () => el.classList.toggle('selected')); });
  app.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', e => handleAction(el.dataset.action, e)));
}

function handleAction(action, event) {
  event.stopPropagation();
  if (action === 'connect') { state.connected = true; showToast('Calendar connected'); render(); }
  if (action === 'onboard-next') { if (state.onboarding < 3) { state.onboarding++; render(); } else go('plan'); }
  if (action === 'onboard-back') { if (state.onboarding > 1) { state.onboarding--; render(); } else go('calendars'); }
  if (action === 'suggest') { app.insertAdjacentHTML('beforeend', modal()); bind(); }
  if (action === 'close-modal') { const shade = app.querySelector('.modal-shade'); if (shade) shade.remove(); }
  if (action === 'confirm-recovery') { state.recoveryAdded = true; render(); showToast('Recovery added to Personal'); }
  if (action === 'add-item') showToast('Manual item form is represented in the wireframes');
  if (action === 'play') togglePlayer();
  if (action === 'restart') { state.elapsed = 0; render(); }
  if (action === 'finish') go('complete');
  if (action === 'reduce-motion') { document.documentElement.classList.toggle('reduce-motion'); showToast('Motion preference changed'); }
  if (action === 'nap-play') toggleNap();
  if (action === 'nap-reset') { state.napRemaining = 1560; state.napRunning = false; clearInterval(state.timer); render(); }
  if (action === 'nap-finish') go('complete');
  if (action === 'nap-sound') showToast('Soft wake sound on');
  if (['checkin','sleep','settings','export','delete-checkins','delete-account'].includes(action)) showToast('Prototype action');
  if (action === 'disconnect') { state.connected = false; showToast('Calendar disconnected'); }
}

function togglePlayer() {
  state.playing = !state.playing;
  clearInterval(state.timer);
  if (state.playing) state.timer = setInterval(() => { state.elapsed++; if (state.elapsed >= state.duration) go('complete'); else render(); }, 1000);
  render();
}

function toggleNap() {
  state.napRunning = !state.napRunning;
  clearInterval(state.timer);
  if (state.napRunning) state.timer = setInterval(() => { state.napRemaining--; if (state.napRemaining <= 0) go('complete'); else render(); }, 1000);
  render();
}

render();
