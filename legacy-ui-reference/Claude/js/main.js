/* Точка входа: применение настроек, глобальные горячие клавиши, запуск системы */
'use strict';

(function () {
  const root = document.documentElement;
  const sysDark = matchMedia('(prefers-color-scheme: dark)');

  function hexToRgb(hex) {
    const m = hex.replace('#', '').match(/.{2}/g);
    return m ? m.map(x => parseInt(x, 16)) : [79, 140, 255];
  }

  function applyTheme() {
    const t = Store.get('theme');
    root.dataset.theme = t === 'auto' ? (sysDark.matches ? 'dark' : 'light') : t;
    applyAccent();
    Desktop.applyWallpaper();
  }

  function applyAccent() {
    const hex = Store.get('accent');
    const [r, g, b] = hexToRgb(hex);
    root.style.setProperty('--accent', hex);
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    root.style.setProperty('--accent-fg', lum > 0.62 ? '#111' : '#fff');
    // текстовый вариант акцента, читаемый на текущем фоне
    const dark = root.dataset.theme === 'dark';
    const mix = (c, t, k) => Math.round(c + (t - c) * k);
    const txt = dark ? [mix(r, 255, .35), mix(g, 255, .35), mix(b, 255, .35)] : [mix(r, 0, .2), mix(g, 0, .2), mix(b, 0, .2)];
    root.style.setProperty('--accent-text', `rgb(${txt.join(',')})`);
  }

  function applyEffects() {
    root.classList.toggle('no-transparency', !Store.get('transparency') || Store.get('batterySaver'));
    root.classList.toggle('no-anim', !Store.get('animations'));
    root.classList.toggle('high-contrast', !!Store.get('highContrast'));
    root.classList.toggle('accent-titlebars', !!Store.get('accentTitlebars'));
    root.style.fontSize = (14 * Store.get('textScale') / 100) + 'px';
    document.getElementById('brightness').style.opacity = ((100 - Store.get('brightness')) / 100 * 0.85).toFixed(3);
    document.getElementById('night-light').style.opacity = Store.get('nightLight') ? (Store.get('nightLightStrength') / 100 * 0.45).toFixed(3) : 0;
  }

  // ---------- Глобальные обработчики ----------
  function bindGlobal() {
    // Закрытие выпадающих панелей при щелчке вне их
    document.addEventListener('pointerdown', e => {
      if (!Shell.anyOpen()) return;
      if (Shell.contains(e.target) || e.target.closest('.ctx-menu, .dlg-backdrop, #taskbar')) return;
      Shell.closeAll();
    }, true);

    // Отключаем стандартное контекстное меню браузера (кроме полей ввода)
    document.addEventListener('contextmenu', e => {
      if (e.target.closest('input, textarea, [contenteditable="true"], iframe')) return;
      e.preventDefault();
    });

    // Горячие клавиши
    document.addEventListener('keydown', e => {
      if (Power.isLocked()) return;
      if (e.key === 'Escape') {
        if (TaskView.isOpen()) { TaskView.hide(); return; }
        if (Shell.anyOpen()) { Shell.closeAll(); return; }
      }
      // Клавиша Windows (если браузер её пропускает)
      if (e.key === 'Meta' && !e.repeat) { metaAlone = true; return; }
      if (!(e.ctrlKey && e.altKey)) return;
      const act = WM.active();
      const map = {
        KeyS: () => Shell.toggle('start'),
        KeyD: () => { Shell.closeAll(); WM.toggleDesktop(); },
        KeyE: () => Apps.launch('explorer'),
        KeyI: () => Apps.launch('settings'),
        KeyT: () => Apps.launch('terminal'),
        KeyL: () => Power.lock(),
        KeyW: () => act && act.close(),
        KeyM: () => act && WM.minimize(act),
        KeyA: () => Shell.toggle('quick'),
        KeyN: () => Shell.toggle('notif'),
        KeyV: () => TaskView.toggle(),
        Tab: () => TaskView.toggle(),
        KeyK: () => Apps.launch('assistant'),
        ArrowLeft: () => act && WM.snap(act, 'left'),
        ArrowRight: () => act && WM.snap(act, 'right'),
        ArrowUp: () => act && WM.maximize(act),
        ArrowDown: () => act && (act.state !== 'normal' ? WM.restore(act) : WM.minimize(act)),
        Delete: () => Apps.launch('taskmgr'),
      };
      const fn = map[e.code];
      if (fn) { e.preventDefault(); e.stopPropagation(); fn(); }
    }, true);
    let metaAlone = false;
    document.addEventListener('keydown', e => { if (e.key !== 'Meta') metaAlone = false; }, true);
    document.addEventListener('keyup', e => {
      if (e.key === 'Meta' && metaAlone && !Power.isLocked()) Shell.toggle('start');
      metaAlone = false;
    });

    // Запрет перетаскивания файлов в никуда (иначе браузер откроет файл)
    addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
    addEventListener('drop', e => e.preventDefault());

    // Сохранение перед закрытием вкладки
    addEventListener('beforeunload', () => Store.flush());
    addEventListener('online', () => UI.notify({ title: 'Подключение к Интернету восстановлено', icon: 'wifi', silent: true, transient: true }));
    addEventListener('offline', () => UI.notify({ title: 'Нет подключения к Интернету', body: 'Проверьте сетевое подключение.', icon: 'wifi-off', transient: true }));
  }

  function init() {
    document.body.insertAdjacentHTML('afterbegin', Icons.defs());
    applyTheme();
    applyEffects();
    Store.on('theme', applyTheme);
    Store.on('accent', applyAccent);
    sysDark.addEventListener('change', () => Store.get('theme') === 'auto' && applyTheme());
    ['transparency', 'animations', 'highContrast', 'accentTitlebars', 'textScale', 'brightness', 'nightLight', 'nightLightStrength', 'batterySaver'].forEach(k => Store.on(k, applyEffects));
    Store.on('wifi', v => UI.notify({ title: v ? 'Wi-Fi включён' : 'Wi-Fi отключён', body: v ? 'Подключено к сети W12-Home.' : 'Беспроводная сеть отключена.', icon: v ? 'wifi' : 'wifi-off', transient: true, silent: true }));
    Store.on('airplane', v => { if (v) Store.set('wifi', false); });

    Desktop.init();
    Taskbar.init();
    StartMenu.init();
    QuickSettings.init();
    NotifCenter.init();
    Widgets.init();
    TaskView.init();
    Power.init();
    bindGlobal();
    Power.boot();
  }

  init();
})();
