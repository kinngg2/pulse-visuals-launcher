const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const logger = require('./src/logger');
const store = require('./src/store');
const api = require('./src/api');
const { launchMinecraft, getRootDir } = require('./src/launcher');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 560,
    minWidth: 760,
    minHeight: 520,
    maxWidth: 1280,
    maxHeight: 760,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#07070b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.PULSE_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  logger.info('app.ready', { logPath: logger.getLogPath(), storePath: store.path });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  logger.info('app.window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC: window controls -------------------------------------------------

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// --- IPC: store -----------------------------------------------------------

ipcMain.handle('store:get', (_event, key) => store.get(key));
ipcMain.handle('store:set', (_event, key, value) => {
  store.set(key, value);
  return true;
});
ipcMain.handle('store:clearProfile', () => {
  store.clearProfile();
  logger.info('store.clearProfile');
  return true;
});

// --- IPC: API -------------------------------------------------------------

ipcMain.handle('api:getVersions', async () => {
  try {
    return await api.getVersions();
  } catch (err) {
    logger.error('api:getVersions failed', { error: err.message });
    throw err;
  }
});

ipcMain.handle('api:checkAuth', async (_event, token) => {
  try {
    return await api.checkAuth(token);
  } catch (err) {
    logger.error('api:checkAuth failed', { error: err.message });
    throw err;
  }
});

ipcMain.handle('api:login', async (_event, username, password) => {
  try {
    const result = await api.login(username, password);
    if (result.ok && result.token) {
      store.set('token', result.token);
      store.set('lastProfile', result.profile);
    }
    return result;
  } catch (err) {
    logger.error('api:login failed', { error: err.message });
    throw err;
  }
});

ipcMain.handle('api:logout', async () => {
  const token = store.get('token');
  try {
    await api.logout(token);
  } catch (err) {
    logger.warn('api:logout failed (continuing)', { error: err.message });
  }
  store.clearProfile();
  return { ok: true };
});

// --- IPC: launch ----------------------------------------------------------

ipcMain.handle('launcher:launchMinecraft', async (_event, payload) => {
  const { versionId, nickname } = payload || {};

  const profile = store.get('lastProfile');
  if (profile && typeof profile.subscription_days === 'number' && profile.subscription_days <= 0) {
    const error = 'Подписка истекла. Запуск заблокирован.';
    logger.warn('launcher:launchMinecraft blocked', { reason: 'subscription_expired' });
    return { ok: false, error };
  }

  store.set('nickname', nickname);
  store.set('selectedVersion', versionId);

  try {
    const result = await launchMinecraft({ versionId, nickname });
    return result;
  } catch (err) {
    logger.error('launcher:launchMinecraft failed', { error: err.message });
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('launcher:openMinecraftFolder', async () => {
  const dir = getRootDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  shell.openPath(dir);
  return { ok: true, path: dir };
});

ipcMain.handle('launcher:openLogs', async () => {
  const p = logger.getLogPath();
  if (fs.existsSync(p)) {
    shell.openPath(p);
  } else {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Логи пока пусты',
      detail: p,
    });
  }
  return { ok: true, path: p };
});
