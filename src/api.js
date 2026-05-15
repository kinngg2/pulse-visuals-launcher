/**
 * API stubs for the MonoClient launcher.
 *
 * Each method mimics the shape of a future remote API. Swap the body of any
 * method with a real `fetch(...)` call to your backend when ready — the public
 * signatures used by the renderer should not change.
 */

const logger = require('./logger');

const API_BASE_URL = process.env.MONOCLIENT_API_URL || 'https://api.monoclient.local';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_VERSIONS = [
  { id: 'fabric-loader-0.16.5-1.21.4', label: 'MonoClient 1.21.4', loader: 'fabric' },
  { id: 'fabric-loader-0.16.5-1.20.4', label: 'MonoClient 1.20.4', loader: 'fabric' },
  { id: 'forge-1.20.1-47.3.0', label: 'MonoClient Legacy 1.20.1', loader: 'forge' },
];

const MOCK_PROFILE = {
  username: 'MonoUser',
  role: 'Пользователь',
  subscription_days: 27,
  user_id: '212200',
  token: 'mock-token-monoclient',
};

const MOCK_CREDENTIALS = {
  monouser: 'mono123',
  test: 'test',
};

async function getVersions() {
  logger.info('api.getVersions called');
  await delay(150);
  return MOCK_VERSIONS;
}

async function checkAuth(token) {
  logger.info('api.checkAuth called', { hasToken: Boolean(token) });
  await delay(120);
  if (!token) {
    return { authenticated: false };
  }
  if (token === MOCK_PROFILE.token) {
    return {
      authenticated: true,
      username: MOCK_PROFILE.username,
      role: MOCK_PROFILE.role,
      subscription_days: MOCK_PROFILE.subscription_days,
      user_id: MOCK_PROFILE.user_id,
    };
  }
  return { authenticated: false, error: 'Invalid or expired token' };
}

async function login(username, password) {
  logger.info('api.login called', { username });
  await delay(250);
  const key = String(username || '').trim().toLowerCase();
  const expected = MOCK_CREDENTIALS[key];
  if (!expected || expected !== password) {
    return { ok: false, error: 'Неверный логин или пароль' };
  }
  return {
    ok: true,
    token: MOCK_PROFILE.token,
    profile: {
      username: username || MOCK_PROFILE.username,
      role: MOCK_PROFILE.role,
      subscription_days: MOCK_PROFILE.subscription_days,
      user_id: MOCK_PROFILE.user_id,
    },
  };
}

async function logout(_token) {
  logger.info('api.logout called');
  await delay(80);
  return { ok: true };
}

module.exports = {
  API_BASE_URL,
  getVersions,
  checkAuth,
  login,
  logout,
};
