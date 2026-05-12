/* Pulse Visuals launcher — renderer logic
 *
 * Communicates with the Electron main process through `window.launcher`
 * (defined in preload.js). Two screens are rendered inside the same window
 * and toggled via the simple router below.
 */

const $ = (sel) => document.querySelector(sel);

const screens = {
  welcome: $('#screen-welcome'),
  profile: $('#screen-profile'),
};

const els = {
  // welcome
  versionCard: $('#version-card'),
  versionLabel: $('#version-label'),
  versionDropdown: $('#version-dropdown'),
  versionList: $('#version-list'),
  nickInput: $('#nick-input'),
  nickConfirm: $('#nick-confirm'),
  nickRandom: $('#nick-random'),
  playBtn: $('#play-btn'),
  openFolder: $('#open-folder'),
  openSettings: $('#open-settings'),
  toast: $('#toast'),

  // profile
  profileUsername: $('#profile-username'),
  profileRole: $('#profile-role'),
  profileSubscription: $('#profile-subscription'),
  profileId: $('#profile-id'),
  btnLogin: $('#btn-login'),
  btnNotMe: $('#btn-not-me'),

  // login modal
  loginModal: $('#login-modal'),
  loginUsername: $('#login-username'),
  loginPassword: $('#login-password'),
  loginError: $('#login-error'),
  loginSubmit: $('#login-submit'),
  loginClose: $('#login-close'),

  // window controls
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

// ---------------------------------------------------------- helpers

function showToast(message, variant = '') {
  const t = els.toast;
  t.textContent = message;
  t.className = 'toast' + (variant ? ` toast--${variant}` : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
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
  const adjectives = ['Swift', 'Neon', 'Pulse', 'Shadow', 'Frost', 'Crimson', 'Vivid', 'Lunar'];
  const nouns = ['Wolf', 'Falcon', 'Tiger', 'Phantom', 'Nova', 'Byte', 'Voxel', 'Pixel'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${a}${n}${num}`;
}

// ---------------------------------------------------------- version dropdown

function renderVersionList() {
  els.versionList.innerHTML = '';
  state.versions.forEach((v) => {
    const li = document.createElement('li');
    li.textContent = v.label;
    li.dataset.id = v.id;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(v.id === state.selectedVersionId));
    li.addEventListener('click', () => {
      selectVersion(v.id);
      toggleVersionDropdown(false);
    });
    els.versionList.appendChild(li);
  });
}

function selectVersion(id) {
  const v = state.versions.find((x) => x.id === id);
  if (!v) return;
  state.selectedVersionId = v.id;
  els.versionLabel.textContent = v.label;
  renderVersionList();
  updatePlayBtnState();
  window.launcher.store.set('selectedVersion', v.id);
}

function toggleVersionDropdown(force) {
  const isHidden = els.versionDropdown.hidden;
  const next = typeof force === 'boolean' ? !force : !isHidden;
  els.versionDropdown.hidden = next;
}

// ---------------------------------------------------------- screen 1: welcome

async function initWelcomeScreen() {
  try {
    const [versions, savedNick, savedVersion] = await Promise.all([
      window.launcher.getVersions(),
      window.launcher.store.get('nickname'),
      window.launcher.store.get('selectedVersion'),
    ]);
    state.versions = Array.isArray(versions) ? versions : [];
    renderVersionList();

    const initialId = savedVersion && state.versions.find((v) => v.id === savedVersion)
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

els.versionCard.addEventListener('click', () => toggleVersionDropdown());

els.nickInput.addEventListener('input', (e) => {
  state.nickname = e.target.value;
  updatePlayBtnState();
});

els.nickConfirm.addEventListener('click', () => {
  const nick = els.nickInput.value.trim();
  if (!nick) {
    showToast('Введите никнейм', 'error');
    return;
  }
  state.nickname = nick;
  window.launcher.store.set('nickname', nick);
  showToast('Ник сохранён', 'success');
  updatePlayBtnState();
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
      showToast('Заглушка: minecraft-launcher-core не установлен', 'error');
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

els.openSettings.addEventListener('click', async () => {
  // The gear icon in the welcome screen opens the profile screen if a session
  // exists, or the login modal otherwise.
  const token = await window.launcher.store.get('token');
  if (token) {
    await refreshProfile();
    showScreen('profile');
  } else {
    openLoginModal();
  }
});

// ---------------------------------------------------------- screen 2: profile

function renderProfile(profile) {
  state.profile = profile;
  els.profileUsername.textContent = profile.username || '—';
  els.profileRole.textContent = profile.role || '—';
  const days = Number(profile.subscription_days);
  els.profileSubscription.textContent = Number.isFinite(days) ? `${days} дн.` : '—';
  els.profileId.textContent = profile.user_id ? String(profile.user_id) : '—';
}

async function refreshProfile() {
  try {
    const token = await window.launcher.store.get('token');
    const cached = await window.launcher.store.get('lastProfile');
    if (cached) renderProfile(cached);
    const result = await window.launcher.checkAuth(token);
    if (result && result.authenticated) {
      const profile = {
        username: result.username,
        role: result.role,
        subscription_days: result.subscription_days,
        user_id: result.user_id,
      };
      renderProfile(profile);
      await window.launcher.store.set('lastProfile', profile);
      if (profile.subscription_days <= 0) {
        showToast('Подписка истекла', 'error');
      }
    }
  } catch (err) {
    showToast('Не удалось обновить профиль', 'error');
    console.error(err);
  }
}

els.btnLogin.addEventListener('click', () => openLoginModal());

els.btnNotMe.addEventListener('click', async () => {
  await window.launcher.logout();
  await window.launcher.store.clearProfile();
  state.profile = null;
  state.nickname = '';
  els.nickInput.value = '';
  updatePlayBtnState();
  showScreen('welcome');
  showToast('Данные очищены', 'success');
});

// ---------------------------------------------------------- login modal

function openLoginModal() {
  els.loginUsername.value = '';
  els.loginPassword.value = '';
  els.loginError.hidden = true;
  els.loginModal.hidden = false;
  setTimeout(() => els.loginUsername.focus(), 60);
}

function closeLoginModal() {
  els.loginModal.hidden = true;
}

els.loginClose.addEventListener('click', closeLoginModal);

els.loginModal.addEventListener('click', (e) => {
  if (e.target === els.loginModal) closeLoginModal();
});

els.loginSubmit.addEventListener('click', async () => {
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  if (!username || !password) {
    els.loginError.textContent = 'Заполните логин и пароль';
    els.loginError.hidden = false;
    return;
  }
  els.loginSubmit.disabled = true;
  try {
    const result = await window.launcher.login(username, password);
    if (!result.ok) {
      els.loginError.textContent = result.error || 'Ошибка входа';
      els.loginError.hidden = false;
      return;
    }
    closeLoginModal();
    renderProfile(result.profile);
    showScreen('profile');
    showToast('Добро пожаловать!', 'success');
  } catch (err) {
    els.loginError.textContent = err.message || 'Ошибка входа';
    els.loginError.hidden = false;
  } finally {
    els.loginSubmit.disabled = false;
  }
});

els.loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.loginSubmit.click();
});

// ---------------------------------------------------------- window controls

els.wcMin.addEventListener('click', () => window.windowControls.minimize());
els.wcClose.addEventListener('click', () => window.windowControls.close());

// ---------------------------------------------------------- click-outside

document.addEventListener('click', (e) => {
  if (!els.versionDropdown.hidden) {
    const inside = e.target.closest('.version-card, .version-dropdown');
    if (!inside) toggleVersionDropdown(false);
  }
});

// ---------------------------------------------------------- bootstrap

async function bootstrap() {
  await initWelcomeScreen();

  const token = await window.launcher.store.get('token');
  const cached = await window.launcher.store.get('lastProfile');
  if (token && cached) {
    renderProfile(cached);
    showScreen('profile');
    refreshProfile();
  } else {
    showScreen('welcome');
  }
}

bootstrap();
