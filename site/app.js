/*
 * MonoClient — shared site script.
 * Handles: local auth (register / login / logout), nav state, CTA gating,
 * profile rendering, toast notifications. No backend; all stored in
 * localStorage for now (intended as a demo / starter — easy to swap for
 * a real API later).
 */
(function () {
  'use strict';

  const STORAGE_USERS = 'mc.users.v1';
  const STORAGE_SESSION = 'mc.session.v1';
  const STORAGE_ROLE_OVERRIDES = 'mc.roleOverrides.v1';

  const ROLES = {
    User: {
      key: 'User',
      label: 'User',
      color: '#9b96ff',
      desc: 'Базовая роль для всех пользователей',
    },
    Premium: {
      key: 'Premium',
      label: 'Premium',
      color: '#ffd166',
      desc: 'Активная подписка MonoClient',
    },
    Reseller: {
      key: 'Reseller',
      label: 'Reseller',
      color: '#06d6a0',
      desc: 'Партнёр, может продавать подписки',
    },
    Mod: {
      key: 'Mod',
      label: 'Mod',
      color: '#4cc9f0',
      desc: 'Модератор сообщества',
    },
    Admin: {
      key: 'Admin',
      label: 'Admin',
      color: '#ef476f',
      desc: 'Администратор проекта',
    },
  };

  // tiny hash (NOT secure — demo only). For real auth, use server-side bcrypt.
  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'h' + (h >>> 0).toString(16);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* noop */
    }
  }

  function getUsers() {
    return readJson(STORAGE_USERS, []);
  }
  function setUsers(users) {
    writeJson(STORAGE_USERS, users);
  }
  function getSession() {
    return readJson(STORAGE_SESSION, null);
  }
  function setSession(sess) {
    if (sess) writeJson(STORAGE_SESSION, sess);
    else localStorage.removeItem(STORAGE_SESSION);
  }

  function findUser(identifier) {
    const id = (identifier || '').trim().toLowerCase();
    if (!id) return null;
    return (
      getUsers().find(
        (u) =>
          (u.username || '').toLowerCase() === id ||
          (u.email || '').toLowerCase() === id,
      ) || null
    );
  }

  function getCurrentUser() {
    const sess = getSession();
    if (!sess || !sess.userId) return null;
    const user = getUsers().find((u) => u.id === sess.userId);
    if (!user) return null;
    return withDerived(user);
  }

  function withDerived(user) {
    // Resolve role: admin override (by username/email match) > stored role
    const overrides = readJson(STORAGE_ROLE_OVERRIDES, {});
    const overrideRole = overrides[user.username] || overrides[user.email];
    const role = overrideRole || user.role || 'User';
    // Premium expiry handling
    let derivedRole = role;
    if (user.subscription && user.subscription.expiresAt) {
      const expired = Date.now() > user.subscription.expiresAt;
      if (!expired && role === 'User') derivedRole = 'Premium';
    }
    return Object.assign({}, user, { role: derivedRole });
  }

  function uuid() {
    return 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // -------- Public API exposed on window.mc --------
  const mc = {
    ROLES,
    getCurrentUser,
    register({ username, email, password }) {
      const errors = [];
      username = (username || '').trim();
      email = (email || '').trim().toLowerCase();
      password = password || '';
      if (username.length < 3) errors.push('Никнейм слишком короткий (мин. 3)');
      if (username.length > 24) errors.push('Никнейм слишком длинный');
      if (!/^[\w.\-]+$/.test(username))
        errors.push('Допустимы только буквы, цифры, _ . -');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        errors.push('Некорректный email');
      if (password.length < 6) errors.push('Пароль слишком короткий (мин. 6)');
      const users = getUsers();
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
        errors.push('Этот никнейм уже занят');
      if (users.some((u) => u.email.toLowerCase() === email))
        errors.push('Email уже зарегистрирован');
      if (errors.length) return { ok: false, errors };
      const isFirst = users.length === 0;
      const user = {
        id: uuid(),
        username,
        email,
        passwordHash: hash(password),
        createdAt: Date.now(),
        role: isFirst ? 'Admin' : 'User',
        subscription: null,
        configs: 0,
        downloads: 0,
      };
      users.push(user);
      setUsers(users);
      setSession({ userId: user.id, ts: Date.now() });
      return { ok: true, user: withDerived(user) };
    },
    login({ identifier, password }) {
      const user = findUser(identifier);
      if (!user) return { ok: false, errors: ['Пользователь не найден'] };
      if (user.passwordHash !== hash(password || ''))
        return { ok: false, errors: ['Неверный пароль'] };
      setSession({ userId: user.id, ts: Date.now() });
      return { ok: true, user: withDerived(user) };
    },
    logout() {
      setSession(null);
    },
    purchase({ planDays, price }) {
      const sess = getSession();
      if (!sess) return { ok: false, errors: ['Нужна авторизация'] };
      const users = getUsers();
      const idx = users.findIndex((u) => u.id === sess.userId);
      if (idx === -1) return { ok: false, errors: ['Пользователь не найден'] };
      const days = Number(planDays) || 30;
      const now = Date.now();
      const existing = users[idx].subscription;
      const base = existing && existing.expiresAt > now ? existing.expiresAt : now;
      users[idx].subscription = {
        planDays: days,
        price: Number(price) || 0,
        startedAt: now,
        expiresAt: base + days * 24 * 60 * 60 * 1000,
      };
      if (users[idx].role === 'User') users[idx].role = 'Premium';
      setUsers(users);
      return { ok: true, user: withDerived(users[idx]) };
    },
    redeemConfig() {
      const sess = getSession();
      if (!sess) return { ok: false };
      const users = getUsers();
      const idx = users.findIndex((u) => u.id === sess.userId);
      if (idx === -1) return { ok: false };
      users[idx].configs = (users[idx].configs || 0) + 1;
      setUsers(users);
      return { ok: true, user: withDerived(users[idx]) };
    },
    incrementDownloads() {
      const sess = getSession();
      if (!sess) return { ok: false };
      const users = getUsers();
      const idx = users.findIndex((u) => u.id === sess.userId);
      if (idx === -1) return { ok: false };
      users[idx].downloads = (users[idx].downloads || 0) + 1;
      setUsers(users);
      return { ok: true, user: withDerived(users[idx]) };
    },
    roleInfo(roleKey) {
      return ROLES[roleKey] || ROLES.User;
    },
    initials(name) {
      const parts = (name || '?').trim().split(/[\s_.-]+/).filter(Boolean);
      const a = (parts[0] || '?')[0];
      const b = parts[1] ? parts[1][0] : '';
      return (a + b).toUpperCase();
    },
    avatarColor(name) {
      let h = 0;
      for (let i = 0; i < (name || '').length; i++)
        h = ((h << 5) - h + (name || '').charCodeAt(i)) | 0;
      const hue = Math.abs(h) % 360;
      return `linear-gradient(135deg, hsl(${hue}, 80%, 65%), hsl(${(hue + 40) % 360}, 80%, 50%))`;
    },
    formatDate(ts) {
      if (!ts) return '—';
      try {
        return new Date(ts).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      } catch {
        return '—';
      }
    },
    formatExpiry(sub) {
      if (!sub || !sub.expiresAt) return null;
      const ms = sub.expiresAt - Date.now();
      if (ms <= 0) return { expired: true, label: 'Подписка истекла', daysLeft: 0 };
      const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
      return { expired: false, label: `Активна · осталось ${days} дн.`, daysLeft: days };
    },
  };

  window.mc = mc;

  // ============= Toast =============
  function toast(message, kind) {
    const el = document.getElementById('site-toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'site-toast' + (kind ? ` site-toast--${kind}` : '');
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 2400);
  }
  mc.toast = toast;

  // ============= Modal =============
  const modal = document.getElementById('auth-modal');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  let pendingAction = null;

  function setTab(tab) {
    document.querySelectorAll('[data-auth-tab]').forEach((b) => {
      const active = b.dataset.authTab === tab;
      b.classList.toggle('is-active', active);
      if (b.getAttribute('role') === 'tab') b.setAttribute('aria-selected', active);
    });
    if (formLogin) formLogin.hidden = tab !== 'login';
    if (formRegister) formRegister.hidden = tab !== 'register';
    [formLogin, formRegister].forEach((f) => {
      const err = f && f.querySelector('[data-auth-error]');
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
    });
  }

  function openModal(tab) {
    if (!modal) return;
    setTab(tab || 'login');
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    const first = modal.querySelector('input');
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.documentElement.style.overflow = '';
    pendingAction = null;
  }

  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-auth-tab]');
    const openBtn = e.target.closest('[data-auth-open]');
    const closeBtn = e.target.closest('[data-modal-close]');
    if (openBtn) {
      e.preventDefault();
      openModal(openBtn.dataset.authOpen);
      return;
    }
    if (closeBtn) {
      e.preventDefault();
      closeModal();
      return;
    }
    if (tabBtn && modal && !modal.hidden) {
      e.preventDefault();
      setTab(tabBtn.dataset.authTab);
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  function showError(form, message) {
    const err = form.querySelector('[data-auth-error]');
    if (!err) return;
    err.textContent = message;
    err.hidden = false;
  }

  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(formLogin);
      const res = mc.login({
        identifier: fd.get('identifier'),
        password: fd.get('password'),
      });
      if (!res.ok) {
        showError(formLogin, res.errors.join(' · '));
        return;
      }
      closeModal();
      toast(`Добро пожаловать, ${res.user.username}`, 'success');
      renderNav();
      if (pendingAction) runPending(pendingAction);
    });
  }
  if (formRegister) {
    formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(formRegister);
      const password = fd.get('password');
      const password2 = fd.get('password2');
      if (!fd.get('agree')) {
        showError(formRegister, 'Нужно согласиться с условиями');
        return;
      }
      if (password !== password2) {
        showError(formRegister, 'Пароли не совпадают');
        return;
      }
      const res = mc.register({
        username: fd.get('username'),
        email: fd.get('email'),
        password,
      });
      if (!res.ok) {
        showError(formRegister, res.errors.join(' · '));
        return;
      }
      closeModal();
      toast(`Аккаунт ${res.user.username} создан`, 'success');
      renderNav();
      if (pendingAction) runPending(pendingAction);
    });
  }

  // ============= Nav state =============
  function renderNav() {
    const out = document.getElementById('nav-auth-out');
    const inn = document.getElementById('nav-auth-in');
    if (!out || !inn) return;
    const user = mc.getCurrentUser();
    if (!user) {
      out.hidden = false;
      inn.hidden = true;
      return;
    }
    out.hidden = true;
    inn.hidden = false;
    const nameEl = document.getElementById('nav-user-name');
    const avEl = document.getElementById('nav-user-avatar');
    const roleEl = document.getElementById('nav-user-role');
    if (nameEl) nameEl.textContent = user.username;
    if (avEl) {
      avEl.textContent = mc.initials(user.username);
      avEl.style.background = mc.avatarColor(user.username);
    }
    if (roleEl) {
      const info = mc.roleInfo(user.role);
      roleEl.textContent = info.label;
      roleEl.style.background = info.color + '22';
      roleEl.style.color = info.color;
      roleEl.style.borderColor = info.color + '55';
    }
  }

  // user menu toggle
  document.addEventListener('click', (e) => {
    const pill = document.getElementById('nav-user-pill');
    const menu = document.getElementById('nav-user-menu');
    if (!pill || !menu) return;
    if (e.target.closest('#nav-user-pill')) {
      const open = !menu.hidden;
      menu.hidden = open;
      pill.setAttribute('aria-expanded', String(!open));
      return;
    }
    if (!menu.hidden && !e.target.closest('#nav-user-menu')) {
      menu.hidden = true;
      pill.setAttribute('aria-expanded', 'false');
    }
  });

  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      mc.logout();
      renderNav();
      const menu = document.getElementById('nav-user-menu');
      if (menu) menu.hidden = true;
      toast('Вы вышли из аккаунта');
      // If we're on the profile page, kick back to home
      if (/profile\.html/.test(location.pathname)) {
        location.href = './index.html';
      }
    });
  }

  // ============= Gated CTAs =============
  function runPending(action) {
    pendingAction = null;
    if (!action) return;
    if (action.kind === 'download') {
      mc.incrementDownloads();
      toast('Скачивание начнётся в новой вкладке', 'success');
      window.open(action.href, '_blank', 'noopener');
    } else if (action.kind === 'buy') {
      const res = mc.purchase({ planDays: action.plan, price: action.price });
      if (res.ok) {
        toast(`Подписка на ${action.plan} дн. оформлена (demo)`, 'success');
        renderNav();
      } else {
        toast(res.errors.join(' · '), 'error');
      }
    }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-gated-action]');
    if (!el) return;
    e.preventDefault();
    const user = mc.getCurrentUser();
    const action = {
      kind: el.dataset.gatedAction,
      href: el.getAttribute('href') || '',
      plan: el.dataset.plan,
      price: el.dataset.price,
    };
    if (!user) {
      pendingAction = action;
      toast('Сначала войдите в аккаунт', 'warn');
      openModal('login');
      return;
    }
    runPending(action);
  });

  // Smooth scroll for in-page anchors (#features, etc.)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    renderNav();
    if (window.mcProfile && typeof window.mcProfile.render === 'function') {
      window.mcProfile.render();
    }
  });
})();
