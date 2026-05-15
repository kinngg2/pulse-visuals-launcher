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
  nickInput: $('#nick-input'),
  nickRandom: $('#nick-random'),
  playBtn: $('#play-btn'),
  openFolder: $('#open-folder'),
  openLogs: $('#open-logs'),
  toast: $('#toast'),

  profileUsername: $('#profile-username'),
  profileRole: $('#profile-role'),
  profileSubscription: $('#profile-subscription'),
  profileId: $('#profile-id'),
  btnNotMe: $('#btn-not-me'),

  loginForm: $('#login-form'),
  loginUsername: $('#login-username'),
  loginPassword: $('#login-password'),
  loginError: $('#login-error'),
  loginSubmit: $('#login-submit'),

  wcMin: $('#wc-minimize'),
  wcClose: $('#wc-close'),
};

const state = {
  versions: [],
  selectedVersionId: null,
  nickname: '',
  profile: null,
};

let toastTimer = null;

function showToast(message, variant = '') {
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
    const visible = key === name;
    el.hidden = !visible;
    el.setAttribute('aria-hidden', String(!visible));
  });
}

function updatePlayBtnState() {
  const ok = Boolean(state.selectedVersionId) && Boolean(state.nickname.trim());
  els.playBtn.disabled = !ok;
}

function randomNickname() {
  const adjectives = ['Mono', 'Fun', 'Neon', 'Nova', 'Shadow', 'Crystal', 'Vortex', 'Lunar'];
  const nouns = ['Player', 'Strafe', 'Cube', 'Byte', 'Storm', 'Flash', 'Knight', 'Pulse'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${a}${n}${num}`;
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
  window.launcher.store.set('selectedVersion', version.id);
}

function toggleVersionDropdown(force) {
  const shouldShow = typeof force === 'boolean' ? force : els.versionDropdown.hidden;
  els.versionDropdown.hidden = !shouldShow;
}

function renderProfile(profile) {
  state.profile = profile;
  els.profileUsername.textContent = profile.username || 'Player';
  els.profileRole.textContent = profile.role || 'Пользователь';
  const days = Number(profile.subscription_days);
  els.profileSubscription.textContent = Number.isFinite(days) ? `${days} дн.` : '—';
  els.profileId.textContent = profile.user_id ? String(profile.user_id) : '—';
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
    const [versions, savedNick, savedVersion] = await Promise.all([
      window.launcher.getVersions(),
      window.launcher.store.get('nickname'),
      window.launcher.store.get('selectedVersion'),
    ]);
    state.versions = Array.isArray(versions) ? versions : [];
    renderVersionList();

    const initialId = savedVersion && state.versions.find((version) => version.id === savedVersion)
      ? savedVersion
      : state.versions[0]?.id;
    if (initialId) selectVersion(initialId);

    if (savedNick) {
      state.nickname = savedNick;
      els.nickInput.value = savedNick;
    }
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

els.versionCard.addEventListener('click', () => toggleVersionDropdown());

document.addEventListener('click', (event) => {
  if (!els.versionDropdown.hidden && !event.target.closest('#version-card, #version-dropdown')) {
    toggleVersionDropdown(false);
  }
});

els.nickInput.addEventListener('input', (event) => {
  state.nickname = event.target.value;
  updatePlayBtnState();
});

els.nickInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.playBtn.click();
});

els.nickRandom.addEventListener('click', () => {
  const nick = randomNickname();
  els.nickInput.value = nick;
  state.nickname = nick;
  updatePlayBtnState();
});

els.playBtn.addEventListener('click', async () => {
  if (els.playBtn.disabled) return;
  if (!state.nickname.trim()) {
    showToast('Введите никнейм', 'error');
    return;
  }
  if (!state.selectedVersionId) {
    showToast('Выберите версию', 'error');
    return;
  }

  els.playBtn.disabled = true;
  const originalLabel = els.playBtn.querySelector('.play-label').textContent;
  els.playBtn.querySelector('.play-label').textContent = 'Запуск…';
  try {
    window.launcher.store.set('nickname', state.nickname.trim());
    const result = await window.launcher.runGame(state.selectedVersionId, state.nickname.trim());
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
    els.playBtn.querySelector('.play-label').textContent = originalLabel;
    updatePlayBtnState();
  }
});

els.openFolder.addEventListener('click', () => {
  window.launcher.openMinecraftFolder();
});

els.openLogs.addEventListener('click', () => {
  window.launcher.openLogs();
});

els.btnNotMe.addEventListener('click', async () => {
  await window.launcher.logout();
  await window.launcher.store.clearProfile();
  state.profile = null;
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
    if (!state.nickname) {
      state.nickname = result.profile.username || username;
      els.nickInput.value = state.nickname;
      window.launcher.store.set('nickname', state.nickname);
    }
    updatePlayBtnState();
    showScreen('launcher');
    showToast('Добро пожаловать!', 'success');
  } catch (err) {
    els.loginError.textContent = err.message || 'Ошибка входа';
    els.loginError.hidden = false;
  } finally {
    els.loginSubmit.disabled = false;
  }
});

els.wcMin.addEventListener('click', () => window.windowControls.minimize());
els.wcClose.addEventListener('click', () => window.windowControls.close());

initSession();
