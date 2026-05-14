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
};

const state = {
  versions: [],
  selectedVersionId: null,
  username: '',
  profile: null,
};

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

initSession();
