/**
 * Minecraft launcher integration via `minecraft-launcher-core`.
 *
 * The core dependency is loaded lazily so the launcher window can still open
 * in environments where the package is missing (e.g. CI). All actions are
 * logged to logs.txt regardless of success.
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const logger = require('./logger');

function getRootDir() {
  return app ? path.join(app.getPath('userData'), 'minecraft') : path.join(process.cwd(), '.minecraft');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseVersion(versionId) {
  // Examples:
  //   fabric-loader-0.16.5-1.21.4  -> { type: 'fabric', mc: '1.21.4', loaderVersion: '0.16.5' }
  //   forge-1.20.1-47.3.0          -> { type: 'forge',  mc: '1.20.1', custom: 'forge-1.20.1-47.3.0' }
  //   vanilla-1.21.4               -> { type: 'release', mc: '1.21.4' }
  if (versionId.startsWith('fabric-loader-')) {
    const rest = versionId.replace('fabric-loader-', '');
    const parts = rest.split('-');
    const loaderVersion = parts.shift();
    return { type: 'fabric', mc: parts.join('-'), loaderVersion, custom: versionId };
  }
  if (versionId.startsWith('forge-')) {
    const rest = versionId.replace('forge-', '');
    const mc = rest.split('-')[0];
    return { type: 'forge', mc, custom: versionId };
  }
  if (versionId.startsWith('vanilla-')) {
    return { type: 'release', mc: versionId.replace('vanilla-', '') };
  }
  return { type: 'release', mc: versionId };
}

async function launchMinecraft({ versionId, nickname, memory }) {
  logger.info('launcher.launchMinecraft', { versionId, nickname });

  if (!nickname || !versionId) {
    const error = 'nickname and versionId are required';
    logger.error('launcher.launchMinecraft: validation failed', { error });
    throw new Error(error);
  }

  let Client;
  try {
    Client = require('minecraft-launcher-core').Client;
  } catch (err) {
    logger.warn('minecraft-launcher-core is not installed; running in stub mode', { error: err.message });
    return {
      ok: true,
      stub: true,
      message:
        'minecraft-launcher-core is not installed. Run `npm install` to enable real Minecraft launching.',
    };
  }

  const root = getRootDir();
  ensureDir(root);
  const parsed = parseVersion(versionId);

  const opts = {
    authorization: {
      access_token: '0',
      client_token: '0',
      uuid: '0',
      name: nickname,
      user_properties: '{}',
      meta: { type: 'mojang', xuid: '0', demo: false },
    },
    root,
    version: {
      number: parsed.mc,
      type: parsed.type === 'release' || parsed.type === 'snapshot' ? parsed.type : 'release',
      custom: parsed.custom,
    },
    memory: {
      max: memory && memory.max ? memory.max : '2G',
      min: memory && memory.min ? memory.min : '1G',
    },
  };

  const launcher = new Client();

  return new Promise((resolve, reject) => {
    launcher.on('debug', (line) => logger.info(`mc-debug: ${line}`));
    launcher.on('data', (line) => logger.info(`mc-data: ${String(line).trim()}`));
    launcher.on('progress', (e) => logger.info('mc-progress', e));
    launcher.on('close', (code) => {
      logger.info('mc-close', { code });
      resolve({ ok: true, code });
    });

    try {
      launcher.launch(opts);
      logger.info('launcher.launch invoked', { versionId, nickname });
      // Resolve as soon as the launch sequence is kicked off so the UI doesn't
      // block on the entire Minecraft session.
      setTimeout(() => resolve({ ok: true, started: true }), 250);
    } catch (err) {
      logger.error('launcher.launchMinecraft failed', { error: err.message });
      reject(err);
    }
  });
}

module.exports = {
  launchMinecraft,
  parseVersion,
  getRootDir,
};
