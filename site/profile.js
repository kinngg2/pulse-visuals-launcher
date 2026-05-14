/* Profile page logic. Renders the logged-in user's data and handles tabs. */
(function () {
  'use strict';
  const mc = window.mc;
  if (!mc) return;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function activateTab(tab) {
    $$('.profile-tab').forEach((b) => {
      const active = b.dataset.profileTab === tab;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active);
    });
    $$('.profile-panel').forEach((p) => {
      const active = p.dataset.profilePanel === tab;
      p.classList.toggle('is-active', active);
      p.hidden = !active;
    });
    if (history.replaceState) history.replaceState(null, '', '#' + tab);
  }

  function bindTabs() {
    $$('.profile-tab').forEach((b) => {
      b.addEventListener('click', () => activateTab(b.dataset.profileTab));
    });
    // Activate from hash
    const hash = (location.hash || '#overview').slice(1);
    if ($(`[data-profile-panel="${hash}"]`)) activateTab(hash);
    else activateTab('overview');
  }

  function render() {
    const user = mc.getCurrentUser();
    const guard = $('#profile-guard');
    const shell = $('#profile-shell');
    if (!user) {
      if (guard) guard.hidden = false;
      if (shell) shell.hidden = true;
      return;
    }
    if (guard) guard.hidden = true;
    if (shell) shell.hidden = false;

    // Hero
    const av = $('#profile-avatar');
    if (av) {
      av.textContent = mc.initials(user.username);
      av.style.background = mc.avatarColor(user.username);
    }
    $('#profile-name').textContent = user.username;
    const info = mc.roleInfo(user.role);
    const roleEl = $('#profile-role');
    roleEl.textContent = info.label;
    roleEl.style.background = info.color + '22';
    roleEl.style.color = info.color;
    roleEl.style.borderColor = info.color + '55';

    $('#profile-email').textContent = user.email;
    $('#profile-since').textContent = mc.formatDate(user.createdAt);

    const subPill = $('#profile-sub-pill');
    const subPillSep = $('#profile-meta-sep-sub');
    const subInfo = mc.formatExpiry(user.subscription);
    if (subInfo && !subInfo.expired) {
      subPill.hidden = false;
      subPillSep.hidden = false;
      $('#profile-sub-pill-label').textContent = `Premium · ${subInfo.daysLeft} дн.`;
    } else {
      subPill.hidden = true;
      subPillSep.hidden = true;
    }

    // Stats
    $('#stat-sub').textContent = subInfo ? (subInfo.expired ? 'Истекла' : `${subInfo.daysLeft} дн.`) : 'Нет';
    $('#stat-configs').textContent = String(user.configs || 0);
    $('#stat-downloads').textContent = String(user.downloads || 0);
    $('#stat-role').textContent = info.label;

    // Overview: subscription card
    const ovStatus = $('#overview-sub-status');
    const ovSub = $('#overview-sub-sub');
    const ovPill = $('#overview-sub-pill');
    if (subInfo && !subInfo.expired) {
      ovStatus.textContent = 'Активна';
      ovSub.textContent = `${user.subscription.planDays} дн. · истекает ${mc.formatDate(user.subscription.expiresAt)}`;
      ovPill.textContent = subInfo.label.replace('Активна · ', '');
      ovPill.style.background = '#06d6a022';
      ovPill.style.color = '#06d6a0';
      ovPill.style.borderColor = '#06d6a055';
    } else {
      ovStatus.textContent = 'Не активна';
      ovSub.textContent = 'Подпишитесь, чтобы получить доступ ко всем функциям MonoClient.';
      ovPill.textContent = 'Free';
    }

    // Activity
    $('#activity-created').textContent = mc.formatDate(user.createdAt);
    if (subInfo && !subInfo.expired) {
      $('#activity-sub-row').hidden = false;
      $('#activity-sub').textContent = `${user.subscription.planDays} дн. · до ${mc.formatDate(user.subscription.expiresAt)}`;
    } else {
      $('#activity-sub-row').hidden = true;
    }

    // Subscriptions tab
    const ssPill = $('#subs-status-pill');
    const ssTitle = $('#subs-state-title');
    const ssSub = $('#subs-state-sub');
    const ssDetail = $('#subs-detail');
    if (subInfo && !subInfo.expired) {
      ssPill.textContent = 'Активна';
      ssPill.style.background = '#06d6a022';
      ssPill.style.color = '#06d6a0';
      ssPill.style.borderColor = '#06d6a055';
      ssTitle.textContent = `Premium · ${user.subscription.planDays} дн.`;
      ssSub.textContent = `Подписка активна до ${mc.formatDate(user.subscription.expiresAt)}.`;
      ssDetail.hidden = false;
      $('#subs-plan').textContent = `${user.subscription.planDays} дней`;
      $('#subs-from').textContent = mc.formatDate(user.subscription.startedAt);
      $('#subs-until').textContent = mc.formatDate(user.subscription.expiresAt);
      $('#subs-price').textContent = `${user.subscription.price} ₽`;
    } else if (subInfo && subInfo.expired) {
      ssPill.textContent = 'Истекла';
      ssTitle.textContent = 'Подписка истекла';
      ssSub.textContent = `Заканчивалась ${mc.formatDate(user.subscription.expiresAt)}.`;
      ssDetail.hidden = true;
    } else {
      ssPill.textContent = 'Нет';
      ssTitle.textContent = 'Не оформлена';
      ssSub.textContent = 'Выберите тариф, чтобы получить доступ к Premium-функциям.';
      ssDetail.hidden = true;
    }
    // Payments
    const body = $('#payments-body');
    if (body) {
      body.innerHTML = '';
      if (user.subscription) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${mc.formatDate(user.subscription.startedAt)}</td>
          <td>${user.subscription.planDays} дн.</td>
          <td>${user.subscription.price} ₽</td>
          <td><span class="badge accent">Оплачено</span></td>
        `;
        body.appendChild(tr);
      } else {
        body.innerHTML = '<tr class="ledger__empty"><td colspan="4">Пока нет платежей. <a href="./index.html#pricing">Оформить</a></td></tr>';
      }
    }

    // Configs tab
    const configsList = $('#configs-list');
    if (configsList) {
      const n = user.configs || 0;
      if (n === 0) {
        configsList.innerHTML = '<div class="configs-empty">Тут будут ваши облачные конфиги. Нажмите «Добавить», чтобы создать первый.</div>';
      } else {
        let html = '';
        for (let i = 1; i <= n; i++) {
          html += `<div class="cfg-item">
            <span>Config #${i} · ${user.username}</span>
            <span class="badge">Cloud</span>
          </div>`;
        }
        configsList.innerHTML = html;
      }
    }

    // Roles tab
    const roleBig = $('#role-pill-big');
    if (roleBig) {
      roleBig.textContent = info.label;
      roleBig.style.background = info.color + '22';
      roleBig.style.color = info.color;
      roleBig.style.borderColor = info.color + '55';
    }
    $('#role-desc').textContent = info.desc;
    const rolesGrid = $('#roles-grid');
    if (rolesGrid) {
      rolesGrid.innerHTML = '';
      Object.values(mc.ROLES).forEach((r) => {
        const isMe = r.key === user.role;
        const node = document.createElement('div');
        node.className = 'role-card' + (isMe ? ' role-card--me' : '');
        node.innerHTML = `
          <span class="role-card__badge" style="background:${r.color}22;color:${r.color};border-color:${r.color}55">${r.label}</span>
          <p class="role-card__desc">${r.desc}</p>
          ${isMe ? '<span class="role-card__me">Это вы</span>' : ''}
        `;
        rolesGrid.appendChild(node);
      });
    }

    // Security
    $('#sec-username').textContent = user.username;
    $('#sec-email').textContent = user.email;
  }

  function bindActions() {
    const claim = (e) => {
      e.preventDefault();
      const res = mc.redeemConfig();
      if (res.ok) {
        mc.toast('Облачный конфиг добавлен', 'success');
        render();
      }
    };
    const c1 = $('#action-claim-config');
    const c2 = $('#action-claim-config-2');
    if (c1) c1.addEventListener('click', claim);
    if (c2) c2.addEventListener('click', claim);

    const logoutBtn = $('#action-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        mc.logout();
        location.href = './index.html';
      });
    }
  }

  window.mcProfile = { render, activateTab };

  document.addEventListener('DOMContentLoaded', () => {
    bindTabs();
    bindActions();
    render();
  });
  window.addEventListener('hashchange', () => {
    const t = (location.hash || '#overview').slice(1);
    if (document.querySelector(`[data-profile-panel="${t}"]`)) activateTab(t);
  });
})();
