/* MonoClient launcher renderer.
 *
 * Drives the login + launcher screens, talks to the main process through the
 * `window.launcher` / `window.windowControls` bridges defined in preload.js.
 */

const $ = (sel) => document.querySelector(sel);

const screens = {
  login: $('#screen-login'),
  launcher: $('#screen-launcher'),
};

const els = {
  versionCard: $('#version-card'),
  versionLabel: $('#version-label'),
  versionDropdown: $('#version-dropdown'),
  versionList: $('#version-list'),
  playBtn: $('#play-btn'),
  toast: $('#toast'),

  profileUsername: $('#profile-username'),
  btnNotMe: $('#btn-not-me'),

  loginForm: $('#login-form'),
  loginUsername: $('#login-username'),
  loginPassword: $('#login-password'),
  loginError: $('#login-error'),
  loginSubmit: $('#login-submit'),
  loginClose: $('#login-close'),

  wcMin: $('#wc-min'),
  wcClose: $('#wc-close'),

  btnSettings: $('#btn-settings'),
  settingsPopover: $('#settings-popover'),
  settingsClose: $('#settings-close'),
  accentGrid: $('#accent-grid'),
  themeDark: $('#theme-dark'),
  themeLight: $('#theme-light'),
};

const state = {
  versions: [],
  selectedVersionId: null,
  username: '',
  profile: null,
  accent: '#7770ff',
  accent2: '#8c86ff',
  theme: 'dark',
};

const ACCENT_DEFAULT = { accent: '#7770ff', accent2: '#8c86ff' };

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function applyAccent(accent, accent2) {
  state.accent = accent;
  state.accent2 = accent2 || accent;
  const root = document.documentElement;
  root.style.setProperty('--accent', state.accent);
  root.style.setProperty('--accent-2', state.accent2);
  const rgb = hexToRgb(state.accent);
  if (rgb) {
    root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
  }
  // update active state in accent grid
  if (els.accentGrid) {
    els.accentGrid.querySelectorAll('.accent-swatch').forEach((btn) => {
      const a = (btn.dataset.accent || '').toLowerCase();
      btn.classList.toggle('accent-swatch--active', a === accent.toLowerCase());
    });
  }
}

function applyTheme(theme) {
  state.theme = theme === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('theme-light', state.theme === 'light');
  if (els.themeDark) els.themeDark.classList.toggle('theme-btn--active', state.theme === 'dark');
  if (els.themeLight) els.themeLight.classList.toggle('theme-btn--active', state.theme === 'light');
}

async function loadPreferences() {
  if (!window.launcher || !window.launcher.store) return;
  try {
    const [storedAccent, storedAccent2, storedTheme] = await Promise.all([
      window.launcher.store.get('accent'),
      window.launcher.store.get('accent2'),
      window.launcher.store.get('theme'),
    ]);
    applyAccent(storedAccent || ACCENT_DEFAULT.accent, storedAccent2 || ACCENT_DEFAULT.accent2);
    applyTheme(storedTheme || 'dark');
  } catch (_) {
    applyAccent(ACCENT_DEFAULT.accent, ACCENT_DEFAULT.accent2);
    applyTheme('dark');
  }
}

function persistAccent(accent, accent2) {
  if (!window.launcher || !window.launcher.store) return;
  try {
    window.launcher.store.set('accent', accent);
    window.launcher.store.set('accent2', accent2);
  } catch (_) { /* ignore */ }
}

function persistTheme(theme) {
  if (!window.launcher || !window.launcher.store) return;
  try {
    window.launcher.store.set('theme', theme);
  } catch (_) { /* ignore */ }
}

function toggleSettings(force) {
  if (!els.settingsPopover) return;
  const next = typeof force === 'boolean' ? force : els.settingsPopover.hidden;
  els.settingsPopover.hidden = !next;
  if (els.btnSettings) {
    els.btnSettings.setAttribute('aria-expanded', String(next));
  }
}

let toastTimer = null;

function showToast(message, variant = '') {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.className = 'toast' + (variant ? ` toast--${variant}` : '');
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3000);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (!el) return;
    const visible = key === name;
    el.hidden = !visible;
    el.setAttribute('aria-hidden', String(!visible));
  });
}

function updatePlayBtnState() {
  const ok = Boolean(state.selectedVersionId) && Boolean(state.username && state.username.trim());
  els.playBtn.disabled = !ok;
}

function renderVersionList() {
  els.versionList.innerHTML = '';
  state.versions.forEach((version) => {
    const li = document.createElement('li');
    li.textContent = version.label;
    li.dataset.id = version.id;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(version.id === state.selectedVersionId));
    li.addEventListener('click', () => {
      selectVersion(version.id);
      toggleVersionDropdown(false);
    });
    els.versionList.appendChild(li);
  });
}

function selectVersion(id) {
  const version = state.versions.find((item) => item.id === id);
  if (!version) return;
  state.selectedVersionId = version.id;
  els.versionLabel.textContent = version.label;
  renderVersionList();
  updatePlayBtnState();
  if (window.launcher && window.launcher.store) {
    window.launcher.store.set('selectedVersion', version.id);
  }
}

function toggleVersionDropdown(force) {
  const shouldShow = typeof force === 'boolean' ? force : els.versionDropdown.hidden;
  els.versionDropdown.hidden = !shouldShow;
}

function renderProfile(profile) {
  state.profile = profile;
  const username = (profile && profile.username) || 'Player';
  state.username = username;
  els.profileUsername.textContent = username;
}

async function refreshProfile() {
  const token = await window.launcher.store.get('token');
  const cached = await window.launcher.store.get('lastProfile');
  if (cached) renderProfile(cached);

  const result = await window.launcher.checkAuth(token);
  if (!result || !result.authenticated) {
    await window.launcher.store.clearProfile();
    showScreen('login');
    return false;
  }

  const profile = {
    username: result.username,
    role: result.role,
    subscription_days: result.subscription_days,
    user_id: result.user_id,
  };
  renderProfile(profile);
  await window.launcher.store.set('lastProfile', profile);
  return true;
}

async function initLauncher() {
  try {
    const [versions, savedVersion] = await Promise.all([
      window.launcher.getVersions(),
      window.launcher.store.get('selectedVersion'),
    ]);
    state.versions = Array.isArray(versions) ? versions : [];
    renderVersionList();

    const initialId = savedVersion && state.versions.find((v) => v.id === savedVersion)
      ? savedVersion
      : (state.versions[0] && state.versions[0].id);
    if (initialId) selectVersion(initialId);

    updatePlayBtnState();
  } catch (err) {
    showToast('Не удалось получить список версий', 'error');
    console.error(err);
  }
}

async function initSession() {
  await initLauncher();
  try {
    const token = await window.launcher.store.get('token');
    if (!token) {
      showScreen('login');
      return;
    }
    const authenticated = await refreshProfile();
    showScreen(authenticated ? 'launcher' : 'login');
  } catch (err) {
    console.error(err);
    showScreen('login');
  }
}

// --- Event wiring --------------------------------------------------------

els.versionCard.addEventListener('click', () => toggleVersionDropdown());

document.addEventListener('click', (event) => {
  if (!els.versionDropdown.hidden && !event.target.closest('#version-card, #version-dropdown')) {
    toggleVersionDropdown(false);
  }
});

els.playBtn.addEventListener('click', async () => {
  if (els.playBtn.disabled) return;
  const nickname = (state.username || '').trim();
  if (!nickname) {
    showToast('Не удалось определить пользователя', 'error');
    return;
  }
  if (!state.selectedVersionId) {
    showToast('Выберите версию', 'error');
    return;
  }

  els.playBtn.disabled = true;
  const labelEl = els.playBtn.querySelector('.play-label');
  const originalLabel = labelEl ? labelEl.textContent : '';
  if (labelEl) labelEl.textContent = 'Запуск…';
  try {
    window.launcher.store.set('nickname', nickname);
    const result = await window.launcher.runGame(state.selectedVersionId, nickname);
    if (result && result.ok === false) {
      showToast(result.error || 'Не удалось запустить игру', 'error');
    } else if (result && result.stub) {
      showToast('Заглушка запуска Minecraft', 'error');
    } else {
      showToast('Запуск Minecraft…', 'success');
    }
  } catch (err) {
    showToast(err.message || 'Ошибка запуска', 'error');
  } finally {
    if (labelEl) labelEl.textContent = originalLabel;
    updatePlayBtnState();
  }
});

els.btnNotMe.addEventListener('click', async () => {
  await window.launcher.logout();
  await window.launcher.store.clearProfile();
  state.profile = null;
  state.username = '';
  showScreen('login');
  showToast('Вы вышли из аккаунта', 'success');
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (!username || !password) {
    els.loginError.textContent = 'Заполните логин и пароль';
    els.loginError.hidden = false;
    return;
  }

  els.loginSubmit.disabled = true;
  els.loginError.hidden = true;
  try {
    const result = await window.launcher.login(username, password);
    if (!result.ok) {
      els.loginError.textContent = result.error || 'Ошибка входа';
      els.loginError.hidden = false;
      return;
    }
    renderProfile(result.profile);
    updatePlayBtnState();
    showScreen('launcher');
    showToast(`Добро пожаловать, ${state.username}!`, 'success');
  } catch (err) {
    els.loginError.textContent = err.message || 'Ошибка входа';
    els.loginError.hidden = false;
  } finally {
    els.loginSubmit.disabled = false;
  }
});

if (els.wcMin) els.wcMin.addEventListener('click', () => window.windowControls.minimize());
if (els.wcClose) els.wcClose.addEventListener('click', () => window.windowControls.close());
if (els.loginClose) els.loginClose.addEventListener('click', () => window.windowControls.close());

// --- Settings popover ---
if (els.btnSettings) {
  els.btnSettings.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSettings();
  });
}

if (els.settingsClose) {
  els.settingsClose.addEventListener('click', () => toggleSettings(false));
}

if (els.accentGrid) {
  els.accentGrid.addEventListener('click', (event) => {
    const swatch = event.target.closest('.accent-swatch');
    if (!swatch) return;
    const accent = swatch.dataset.accent;
    const accent2 = swatch.dataset.accent2 || accent;
    if (!accent) return;
    applyAccent(accent, accent2);
    persistAccent(accent, accent2);
    showToast('Цвет акцента обновлён', 'success');
  });
}

if (els.themeDark) {
  els.themeDark.addEventListener('click', () => {
    applyTheme('dark');
    persistTheme('dark');
  });
}
if (els.themeLight) {
  els.themeLight.addEventListener('click', () => {
    applyTheme('light');
    persistTheme('light');
  });
}

// Close settings popover when clicking outside
document.addEventListener('click', (event) => {
  if (!els.settingsPopover || els.settingsPopover.hidden) return;
  if (event.target.closest('#settings-popover, #btn-settings')) return;
  toggleSettings(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.settingsPopover && !els.settingsPopover.hidden) {
    toggleSettings(false);
  }
});

// --- Make preview color dots interactive too ---
document.addEventListener('click', (event) => {
  const dot = event.target.closest('.module-card__colors .dot');
  if (!dot || dot.classList.contains('dot--brand')) return;
  const bg = dot.style.backgroundColor || getComputedStyle(dot).backgroundColor;
  // convert rgb() to hex
  const m = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return;
  const toHex = (n) => Number(n).toString(16).padStart(2, '0');
  const hex = `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  applyAccent(hex, hex);
  persistAccent(hex, hex);
  showToast('Цвет акцента обновлён', 'success');
});

loadPreferences();
initSession();
