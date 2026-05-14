const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logFilePath = null;

function getLogPath() {
  if (logFilePath) return logFilePath;
  const dir = app ? app.getPath('userData') : process.cwd();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logFilePath = path.join(dir, 'logs.txt');
  return logFilePath;
}

function formatLine(level, message, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level}] ${message}${metaStr}\n`;
}

function write(level, message, meta) {
  const line = formatLine(level, message, meta);
  try {
    fs.appendFileSync(getLogPath(), line, 'utf-8');
  } catch (err) {
    console.error('logger: failed to write log', err);
  }
  if (level === 'ERROR') {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }
}

module.exports = {
  info: (message, meta) => write('INFO', message, meta),
  warn: (message, meta) => write('WARN', message, meta),
  error: (message, meta) => write('ERROR', message, meta),
  getLogPath,
};
