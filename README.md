# MonoClient Launcher

Лаунчер для Minecraft-клиента под **Funtime.su** на **Electron + Node.js**. UI отрисовывается через локальный HTML/CSS/JS, а Electron main process общается с рендером через `contextBridge` IPC.

## Возможности

- Два экрана в стиле референса Expensive: логин и основной лаунчер.
- Тёмный frameless-интерфейс с фиолетовыми акцентами, grid-фоном и промо-панелью.
- Локальное хранилище ника, токена, профиля и выбранной версии через `electron-store`.
- Логирование действий в `logs.txt` в директории `userData`.
- Запуск Minecraft через `minecraft-launcher-core` (Fabric/Forge/Vanilla), offline-режим без MS Auth.
- Заглушки API (`getVersions`, `checkAuth`, `login`, `logout`) готовы к замене на реальный HTTP.
- Блокировка запуска при истёкшей подписке (`subscription_days <= 0`).
- Сборка `.exe` (NSIS), `.app` (DMG, x64 + arm64), `.AppImage` через `electron-builder`.

## Структура

```
pulse-visuals-launcher/
├── main.js                 # Electron main process + IPC handlers
├── preload.js              # contextBridge: window.launcher, window.windowControls
├── src/
│   ├── api.js              # API stubs (checkAuth, login, logout, getVersions)
│   ├── launcher.js         # launchMinecraft via minecraft-launcher-core
│   ├── logger.js           # logs.txt writer
│   └── store.js            # electron-store wrapper
└── renderer/
    ├── index.html          # login screen + launcher screen
    ├── style.css           # Expensive-inspired dark MonoClient UI
    └── app.js              # screen router, handlers, IPC calls
```

## Запуск в режиме разработки

```bash
npm install
npm start
```

Открыть DevTools: `PULSE_DEVTOOLS=1 npm start`.

## Сборка дистрибутивов

```bash
npm run build:win    # → dist/*.exe (NSIS installer)
npm run build:mac    # → dist/*.dmg (x64 + arm64)
npm run build:linux  # → dist/*.AppImage
```

## API-мост (renderer → main)

Доступно через `window.launcher`:

| Метод | Описание |
| --- | --- |
| `getVersions()` | список версий клиента (`[{ id, label, loader }, …]`) |
| `checkAuth(token)` | проверка токена → `{ authenticated, role, subscription_days, user_id, … }` |
| `login(username, password)` | вход → `{ ok, token, profile }` |
| `logout()` | выход + очистка локального профиля |
| `runGame(versionId, nickname)` | запуск Minecraft через `launch_minecraft` |
| `openMinecraftFolder()` | открыть папку `.minecraft` в проводнике |
| `openLogs()` | открыть `logs.txt` |
| `store.get/set/clearProfile` | работа с локальным конфигом |

Окно: `window.windowControls.minimize()` / `close()`.

## Подмена заглушек на реальный API

Откройте `src/api.js` и замените тела методов на HTTP-запросы:

```js
async function login(username, password) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}
```

Базовый URL берётся из переменной окружения `MONOCLIENT_API_URL`.

## Тестовые данные

В режиме заглушек принимаются два логина:

| login | password |
| --- | --- |
| `monouser` | `mono123` |
| `test` | `test` |

Профиль возвращает `subscription_days = 27`. Чтобы протестировать сценарий истёкшей подписки, выставьте `subscription_days <= 0` в `src/api.js`.

## Логи

`logs.txt` пишется в `app.getPath('userData')`:

- Windows: `%APPDATA%\monoclient-launcher\logs.txt`
- macOS: `~/Library/Application Support/monoclient-launcher/logs.txt`
- Linux: `~/.config/monoclient-launcher/logs.txt`

## Лицензия

MIT.
