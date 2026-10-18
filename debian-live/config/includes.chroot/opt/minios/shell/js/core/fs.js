/* Виртуальная файловая система, сохраняемая в localStorage */
'use strict';

const FS = (() => {
  const USER = 'C:/Пользователи/Пользователь';
  const P = {
    home: USER,
    desktop: USER + '/Рабочий стол',
    docs: USER + '/Документы',
    downloads: USER + '/Загрузки',
    pictures: USER + '/Изображения',
    music: USER + '/Музыка',
    videos: USER + '/Видео',
  };
  const DRIVES = {
    'C:': { label: 'Локальный диск', total: 256e9, base: 41.7e9 },
    'D:': { label: 'Данные', total: 512e9, base: 118.3e9 },
  };
  const em = new Emitter();
  let root, bin, frozen = false;

  const now = () => Date.now();
  const D = (c = {}, extra = {}) => ({ t: 'd', c, ct: now(), mt: now(), ...extra });
  const F = (c = '', extra = {}) => ({ t: 'f', c, ct: now(), mt: now(), ...extra });
  const lnk = (app, args) => F(JSON.stringify(args ? { app, args } : { app }));
  const svgURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

  function sampleImages() {
    const aurora = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a1f"/><stop offset="1" stop-color="#14254d"/></linearGradient><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3cffb0" stop-opacity="0"/><stop offset=".5" stop-color="#3cffb0" stop-opacity=".8"/><stop offset="1" stop-color="#8a5cff" stop-opacity="0"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="1200" height="750" fill="url(#s)"/><g filter="url(#b)"><path d="M-50 330 C250 120 450 420 700 220 S1100 160 1250 260 L1250 330 C1000 260 850 420 650 330 S200 300 -50 420Z" fill="url(#a)"/><path d="M-50 200 C300 60 600 300 900 120 S1150 80 1250 120 L1250 180 C1000 200 800 330 600 260 S150 240 -50 300Z" fill="url(#a)" opacity=".6"/></g>${Array.from({ length: 90 }, (_, i) => `<circle cx="${(i * 137) % 1200}" cy="${(i * 71) % 420}" r="${(i % 3) * 0.6 + 0.6}" fill="#fff" opacity="${0.3 + (i % 5) / 8}"/>`).join('')}<path d="M0 620 L180 520 L300 580 L460 470 L640 590 L800 500 L980 600 L1200 520 L1200 750 L0 750Z" fill="#070b18"/><path d="M0 680 L220 600 L420 660 L620 590 L860 670 L1060 610 L1200 650 L1200 750 L0 750Z" fill="#03060e"/></svg>`;
    const mountains = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf9e"/><stop offset=".55" stop-color="#ff8c7a"/><stop offset="1" stop-color="#7a4b9c"/></linearGradient></defs><rect width="1200" height="750" fill="url(#s)"/><circle cx="820" cy="330" r="90" fill="#fff4d6" opacity=".9"/><path d="M0 470 L200 300 L340 420 L520 250 L720 440 L900 330 L1200 470 L1200 750 L0 750Z" fill="#9a5c9e" opacity=".7"/><path d="M0 560 L160 450 L360 560 L560 420 L780 560 L960 470 L1200 560 L1200 750 L0 750Z" fill="#6b3f86"/><path d="M0 650 L240 560 L480 650 L700 580 L940 660 L1200 600 L1200 750 L0 750Z" fill="#3e2560"/></svg>`;
    const waves = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0fd1ff"/><stop offset="1" stop-color="#2a3bff"/></linearGradient></defs><rect width="1200" height="750" fill="url(#s)"/>${[0, 1, 2, 3, 4, 5].map(i => `<path d="M0 ${300 + i * 80} C200 ${240 + i * 80} 400 ${360 + i * 80} 600 ${300 + i * 80} S1000 ${240 + i * 80} 1200 ${300 + i * 80} L1200 750 L0 750Z" fill="#fff" opacity="${0.06 + i * 0.03}"/>`).join('')}</svg>`;
    return { 'Северное сияние.svg': svgURL(aurora), 'Горы на закате.svg': svgURL(mountains), 'Волны.svg': svgURL(waves) };
  }

  function defaultTree() {
    const imgs = sampleImages();
    const pictures = {};
    for (const [n, u] of Object.entries(imgs)) pictures[n] = F(u);
    return {
      'C:': D({
        'Program Files': D({
          'Windows 12': D({
            'Блокнот': D({ 'notepad.exe': F('notepad') }),
            'Калькулятор': D({ 'calc.exe': F('calculator') }),
            'Paint': D({ 'mspaint.exe': F('paint') }),
            'Терминал': D({ 'terminal.exe': F('terminal') }),
            'Браузер': D({ 'browser.exe': F('browser') }),
          }),
          'Common Files': D(),
        }, { sys: 1 }),
        'Windows': D({
          'System32': D({
            'drivers': D({ 'etc': D({ 'hosts': F('# Файл hosts\n127.0.0.1       localhost\n::1             localhost\n') }) }),
            'cmd.exe': F('terminal'),
            'taskmgr.exe': F('taskmgr'),
            'explorer.exe': F('explorer'),
            'kernel32.dll': F('MZ\u0090\u0000\u0003 — системная библиотека Windows 12 (веб-эмуляция)'),
            'config.sys': F('DEVICE=C:\\Windows\\System32\\himem.sys\nFILES=40\n'),
          }),
          'Fonts': D({ 'SegoeUI.ttf': F('шрифт') }),
          'win.ini': F('; for 16-bit app support\n[fonts]\n[extensions]\n[mci extensions]\n[files]\n[Mail]\nMAPI=1\n'),
        }, { sys: 1 }),
        'Пользователи': D({
          'Пользователь': D({
            'Рабочий стол': D({
              'Этот компьютер.lnk': lnk('explorer', { path: 'thispc://' }),
              'Браузер.lnk': lnk('browser'),
              'Документы.lnk': lnk('explorer', { path: P.docs }),
              'Параметры.lnk': lnk('settings'),
              'Терминал.lnk': lnk('terminal'),
              'Paint.lnk': lnk('paint'),
              'Сапёр.lnk': lnk('minesweeper'),
              'Ассистент.lnk': lnk('assistant'),
              'Прочти меня.txt': F(README),
            }),
            'Документы': D({
              'Добро пожаловать.txt': F('Добро пожаловать в Windows 12!\n\nЭто полностью интерактивная веб-версия операционной системы.\nВсе файлы, которые вы создаёте, сохраняются в браузере и никуда не пропадут после перезагрузки страницы.\n\nПопробуйте:\n • перетаскивать окна к краям экрана — они прилипнут;\n • навести курсор на кнопку «Развернуть» — появятся макеты прикрепления;\n • щёлкнуть правой кнопкой мыши по рабочему столу;\n • спросить что-нибудь у Ассистента.\n'),
              'Список дел.txt': F('☐ Настроить обои и цвет акцента\n☐ Нарисовать что-нибудь в Paint\n☐ Сыграть в Сапёра на уровне «Профессионал»\n☐ Добавить события в Календарь\n☑ Запустить Windows 12\n'),
              'Проекты': D({
                'Идеи.md': F('# Идеи\n\n- Сайт-портфолио\n- Игра на canvas\n- Трекер привычек\n'),
                'index.html': F('<!doctype html>\n<html lang="ru">\n<head><meta charset="utf-8"><title>Моя страница</title>\n<style>body{font-family:Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:linear-gradient(135deg,#4f8cff,#a35cff);color:#fff}button{font-size:18px;padding:10px 20px;border-radius:10px;border:0;cursor:pointer}</style></head>\n<body>\n<div style="text-align:center">\n<h1>Привет из Windows 12!</h1>\n<p>Эту страницу можно редактировать в Блокноте.</p>\n<button onclick="this.textContent=\'Нажато \' + (++window.n||(window.n=1)) + \' раз\'">Нажми меня</button>\n</div>\n</body>\n</html>\n'),
                'script.js': F('// Пример JavaScript\nfunction greet(name) {\n  return `Привет, ${name}!`;\n}\n\nconsole.log(greet("мир"));\n'),
              }),
            }),
            'Загрузки': D(),
            'Изображения': D(pictures),
            'Музыка': D(),
            'Видео': D(),
          }),
        }, { sys: 1 }),
      }),
      'D:': D({
        'Резервные копии': D(),
        'Игры': D({ 'Сапёр': D({ 'minesweeper.exe': F('minesweeper') }), '2048': D({ '2048.exe': F('game2048') }) }),
        'readme.txt': F('Диск D: — для ваших данных.\n'),
      }),
    };
  }

  const README = 'Windows 12 — веб-версия\n=======================\n\nГорячие клавиши:\n  Ctrl+Alt+S — меню «Пуск»\n  Ctrl+Alt+D — показать рабочий стол\n  Ctrl+Alt+E — Проводник\n  Ctrl+Alt+I — Параметры\n  Ctrl+Alt+T — Терминал\n  Ctrl+Alt+L — заблокировать\n  Ctrl+Alt+W — закрыть активное окно\n  Ctrl+Alt+Tab / Ctrl+Alt+V — представление задач\n  Ctrl+Alt+Стрелки — прикрепить окно\n  Esc — закрыть меню\n\nМожно перетаскивать файлы с вашего компьютера прямо на рабочий стол или в окно Проводника.\n';

  function load() {
    const saved = Persist.get('fs', null);
    if (saved && saved.root && saved.root['C:']) { root = saved.root; bin = saved.bin || []; }
    else { root = defaultTree(); bin = []; save(); }
  }

  const save = debounce(() => {
    if (frozen) return;
    Persist.set('fs', { root, bin });
  }, 400);

  function changed(info = {}) { save(); em.emit('change', info); }

  // ---------- Пути ----------
  function norm(p) {
    p = String(p || '').replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
    if (/^[a-z]:/i.test(p)) p = p[0].toUpperCase() + p.slice(1);
    return p;
  }
  const split = p => norm(p).split('/').filter(Boolean);
  const join = (...a) => norm(a.filter(Boolean).join('/'));
  const parent = p => split(p).slice(0, -1).join('/');
  const basename = p => { const s = split(p); return s[s.length - 1] || ''; };
  const ext = n => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; };
  const stem = n => { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(0, i) : n; };
  const display = p => norm(p).replace(/\//g, '\\') + (/^[A-Z]:$/.test(norm(p)) ? '\\' : '');

  function key(dir, name) {
    if (!dir || dir.t !== 'd') return null;
    if (name in dir.c) return name;
    const low = name.toLowerCase();
    return Object.keys(dir.c).find(k => k.toLowerCase() === low) ?? null;
  }

  function get(path) {
    const parts = split(path);
    if (!parts.length) return null;
    let n = root[parts[0].toUpperCase()];
    for (let i = 1; i < parts.length && n; i++) {
      const k = key(n, parts[i]);
      n = k === null ? null : n.c[k];
    }
    return n || null;
  }

  /** Возвращает путь с реальным регистром имён */
  function realPath(path) {
    const parts = split(path);
    if (!parts.length || !root[parts[0].toUpperCase()]) return null;
    let n = root[parts[0].toUpperCase()];
    const out = [parts[0].toUpperCase()];
    for (let i = 1; i < parts.length; i++) {
      const k = key(n, parts[i]);
      if (k === null) return null;
      out.push(k); n = n.c[k];
    }
    return out.join('/');
  }

  function validName(name) {
    name = String(name || '').trim();
    if (!name) throw new Error('Имя не может быть пустым.');
    if (/[\\/:*?"<>|]/.test(name)) throw new Error('Имя файла не может содержать следующие знаки: \\ / : * ? " < > |');
    if (name === '.' || name === '..') throw new Error('Недопустимое имя.');
    if (name.length > 200) throw new Error('Слишком длинное имя.');
    return name;
  }

  function dirNode(path) {
    const n = get(path);
    if (!n) throw new Error('Путь не найден: ' + display(path));
    if (n.t !== 'd') throw new Error('Это не папка: ' + display(path));
    return n;
  }

  function isProtected(path) {
    const p = realPath(path) || norm(path);
    const prot = ['C:/Windows', 'C:/Program Files', 'C:/Пользователи', USER, ...Object.values(P)];
    return split(p).length <= 1 || prot.includes(p) || p.startsWith('C:/Windows/');
  }

  function unique(dirPath, name) {
    const d = get(dirPath);
    if (!d || key(d, name) === null) return name;
    const isFile = name.includes('.') && !name.startsWith('.');
    const s = isFile ? stem(name) : name;
    const e = isFile ? name.slice(s.length) : '';
    for (let i = 2; ; i++) {
      const cand = `${s} (${i})${e}`;
      if (key(d, cand) === null) return cand;
    }
  }

  // ---------- Операции ----------
  function list(path) {
    const d = dirNode(path);
    const base = realPath(path);
    return Object.keys(d.c).map(name => ({ name, path: base + '/' + name, node: d.c[name], isDir: d.c[name].t === 'd' }))
      .sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name, 'ru', { numeric: true }));
  }

  function mkdir(path) {
    const par = dirNode(parent(path));
    const name = validName(basename(path));
    if (key(par, name) !== null) throw new Error(`Элемент «${name}» уже существует.`);
    par.c[name] = D();
    par.mt = now();
    changed({ dir: parent(path) });
    return realPath(parent(path)) + '/' + name;
  }

  function mkdirp(path) {
    const parts = split(path);
    let cur = parts[0];
    for (let i = 1; i < parts.length; i++) {
      cur += '/' + parts[i];
      const n = get(cur);
      if (!n) mkdir(cur);
      else if (n.t !== 'd') throw new Error('Это не папка: ' + display(cur));
    }
    return realPath(path);
  }

  function write(path, content) {
    const par = dirNode(parent(path));
    const name = validName(basename(path));
    const k = key(par, name);
    if (k !== null) {
      const n = par.c[k];
      if (n.t === 'd') throw new Error('Папка с таким именем уже существует.');
      n.c = content; n.mt = now();
    } else {
      par.c[name] = F(content);
    }
    par.mt = now();
    changed({ dir: parent(path), path });
    return realPath(path);
  }

  function read(path) {
    const n = get(path);
    if (!n) throw new Error('Файл не найден: ' + display(path));
    if (n.t !== 'f') throw new Error('Это папка: ' + display(path));
    return n.c;
  }

  function rename(path, newName) {
    newName = validName(newName);
    const rp = realPath(path);
    if (!rp) throw new Error('Элемент не найден.');
    if (isProtected(rp)) throw new Error('Отказано в доступе. Этот элемент защищён системой.');
    const parPath = parent(rp);
    const par = get(parPath);
    const old = basename(rp);
    if (old === newName) return rp;
    const ex = key(par, newName);
    if (ex !== null && ex !== old) throw new Error(`Элемент «${newName}» уже существует в этой папке.`);
    // сохраняем порядок ключей
    const entries = Object.entries(par.c).map(([k, v]) => k === old ? [newName, v] : [k, v]);
    par.c = Object.fromEntries(entries);
    par.c[newName].mt = now();
    changed({ dir: parPath, renamed: [rp, parPath + '/' + newName] });
    return parPath + '/' + newName;
  }

  function detach(path) {
    const rp = realPath(path);
    if (!rp) throw new Error('Элемент не найден.');
    if (isProtected(rp)) throw new Error('Отказано в доступе. Этот элемент защищён системой.');
    const par = get(parent(rp));
    const name = basename(rp);
    const node = par.c[name];
    delete par.c[name];
    par.mt = now();
    return { node, name, rp };
  }

  function remove(path) {
    const { node, name, rp } = detach(path);
    const id = uid('bin');
    bin.unshift({ id, name, orig: parent(rp), node, dt: now() });
    changed({ dir: parent(rp), removed: rp });
    return id;
  }

  function removePermanent(path) {
    const { rp } = detach(path);
    changed({ dir: parent(rp), removed: rp });
  }

  function restore(id) {
    const i = bin.findIndex(b => b.id === id);
    if (i < 0) return null;
    const b = bin[i];
    if (!get(b.orig)) mkdirp(b.orig);
    const name = unique(b.orig, b.name);
    get(b.orig).c[name] = b.node;
    bin.splice(i, 1);
    changed({ dir: b.orig });
    return realPath(b.orig) + '/' + name;
  }

  function purge(id) {
    const i = bin.findIndex(b => b.id === id);
    if (i >= 0) { bin.splice(i, 1); changed({ bin: true }); }
  }

  function emptyBin() { bin = []; changed({ bin: true }); }

  const clone = n => structuredClone(n);

  function isInside(child, par) {
    const c = (realPath(child) || norm(child)).toLowerCase();
    const p = (realPath(par) || norm(par)).toLowerCase();
    return c === p || c.startsWith(p + '/');
  }

  function copy(src, destDir) {
    const rs = realPath(src);
    const n = get(rs);
    if (!n) throw new Error('Элемент не найден.');
    const dest = dirNode(destDir);
    if (n.t === 'd' && isInside(destDir, rs)) throw new Error('Конечная папка является вложенной в исходную.');
    let name = basename(rs);
    if (key(dest, name) !== null) {
      const isFile = n.t === 'f' && ext(name);
      const cname = isFile ? `${stem(name)} — копия.${ext(name)}` : `${name} — копия`;
      name = unique(destDir, cname);
    }
    const c = clone(n);
    c.ct = c.mt = now();
    dest.c[name] = c;
    changed({ dir: destDir });
    return realPath(destDir) + '/' + name;
  }

  function move(src, destDir) {
    const rs = realPath(src);
    if (!rs) throw new Error('Элемент не найден.');
    const rd = realPath(destDir);
    if (!rd) throw new Error('Папка назначения не найдена.');
    if (parent(rs).toLowerCase() === rd.toLowerCase()) return rs;
    if (isInside(rd, rs)) throw new Error('Невозможно переместить папку в саму себя.');
    const dest = dirNode(rd);
    const { node, name } = detach(rs);
    const nn = unique(rd, name);
    dest.c[nn] = node;
    dest.mt = now();
    changed({ dir: rd, moved: [rs, rd + '/' + nn] });
    return rd + '/' + nn;
  }

  function nodeSize(n) {
    if (!n) return 0;
    if (n.t === 'd') return Object.values(n.c).reduce((s, c) => s + nodeSize(c), 0);
    const s = n.c || '';
    if (s.startsWith('data:')) {
      const i = s.indexOf(',');
      return s.slice(0, i).includes('base64') ? Math.round((s.length - i - 1) * 3 / 4) : decodeURIComponent(s.slice(i + 1)).length;
    }
    let b = 0;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b += c < 0x80 ? 1 : c < 0x800 ? 2 : 3; }
    return b;
  }

  function countItems(n) {
    let files = 0, dirs = 0;
    (function walk(x) { for (const c of Object.values(x.c)) { if (c.t === 'd') { dirs++; walk(c); } else files++; } })(n);
    return { files, dirs };
  }

  function walk(path, fn) {
    const start = realPath(path);
    if (!start) return;
    (function rec(p, n) {
      for (const [name, c] of Object.entries(n.c)) {
        const cp = p + '/' + name;
        if (fn(cp, c, name) === false) return false;
        if (c.t === 'd' && rec(cp, c) === false) return false;
      }
    })(start, get(start));
  }

  function search(path, query, limit = 200) {
    const q = query.toLowerCase();
    const res = [];
    walk(path, (p, n, name) => {
      if (name.toLowerCase().includes(q)) res.push({ name, path: p, node: n, isDir: n.t === 'd' });
      if (res.length >= limit) return false;
    });
    return res;
  }

  const TYPES = {
    txt: ['text', 'Текстовый документ', 'file-text'], log: ['text', 'Файл журнала', 'file-text'], ini: ['text', 'Параметры конфигурации', 'file-text'],
    cfg: ['text', 'Файл конфигурации', 'file-text'], md: ['text', 'Документ Markdown', 'file-text'], csv: ['text', 'Файл CSV', 'file-text'],
    sys: ['text', 'Системный файл', 'file-generic'], dll: ['other', 'Расширение приложения', 'file-generic'],
    js: ['code', 'Файл JavaScript', 'file-code'], ts: ['code', 'Файл TypeScript', 'file-code'], css: ['code', 'Каскадная таблица стилей', 'file-code'],
    json: ['code', 'Файл JSON', 'file-code'], py: ['code', 'Файл Python', 'file-code'], xml: ['code', 'Документ XML', 'file-code'],
    c: ['code', 'Исходный код C', 'file-code'], cpp: ['code', 'Исходный код C++', 'file-code'], java: ['code', 'Исходный код Java', 'file-code'],
    html: ['html', 'HTML-документ', 'file-html'], htm: ['html', 'HTML-документ', 'file-html'],
    png: ['image', 'Изображение PNG', 'file-image'], jpg: ['image', 'Изображение JPEG', 'file-image'], jpeg: ['image', 'Изображение JPEG', 'file-image'],
    gif: ['image', 'Изображение GIF', 'file-image'], webp: ['image', 'Изображение WebP', 'file-image'], svg: ['image', 'Изображение SVG', 'file-image'], bmp: ['image', 'Точечный рисунок', 'file-image'],
    mp3: ['audio', 'Аудиофайл MP3', 'file-audio'], wav: ['audio', 'Аудиофайл WAV', 'file-audio'], ogg: ['audio', 'Аудиофайл OGG', 'file-audio'], m4a: ['audio', 'Аудиофайл M4A', 'file-audio'], flac: ['audio', 'Аудиофайл FLAC', 'file-audio'],
    mp4: ['video', 'Видеофайл MP4', 'file-video'], webm: ['video', 'Видеофайл WebM', 'file-video'],
    lnk: ['lnk', 'Ярлык', 'file-generic'], exe: ['exe', 'Приложение', 'file-generic'],
  };
  const FOLDER_ICONS = { [P.desktop]: 'folder-desktop', [P.docs]: 'folder-docs', [P.downloads]: 'folder-downloads', [P.pictures]: 'folder-images', [P.music]: 'folder-music', [P.videos]: 'folder-video' };

  function parseLnk(n) { try { return JSON.parse(n.c); } catch { return null; } }

  /** Сведения о типе элемента: kind, label, icon */
  function typeOf(path, node) {
    node = node || get(path);
    if (!node) return { kind: 'other', label: 'Файл', icon: 'file-generic' };
    if (node.t === 'd') return { kind: 'folder', label: 'Папка с файлами', icon: FOLDER_ICONS[realPath(path)] || 'folder' };
    const e = ext(basename(path));
    const t = TYPES[e];
    if (t && t[0] === 'lnk') {
      const l = parseLnk(node);
      let icon = 'file-generic';
      if (l) {
        if (l.app === 'explorer' && l.args?.path) {
          icon = l.args.path === 'thispc://' ? 'thispc' : l.args.path === 'bin://' ? 'recycle' : (FOLDER_ICONS[l.args.path] || 'folder');
        } else icon = typeof Apps !== 'undefined' && Apps.get(l.app) ? Apps.get(l.app).icon : 'file-generic';
      }
      return { kind: 'lnk', label: 'Ярлык', icon, shortcut: true, target: l };
    }
    if (t && t[0] === 'exe') {
      const app = typeof Apps !== 'undefined' && Apps.get(node.c);
      return { kind: 'exe', label: 'Приложение', icon: app ? app.icon : 'file-generic', app: node.c };
    }
    if (t) return { kind: t[0], label: t[1], icon: t[2] };
    return { kind: 'other', label: e ? `Файл «${e.toUpperCase()}»` : 'Файл', icon: 'file-generic' };
  }

  function drives() {
    return Object.entries(DRIVES).map(([letter, d]) => {
      const used = d.base + nodeSize(root[letter]);
      return { letter, label: d.label, total: d.total, used, free: d.total - used, path: letter };
    });
  }

  load();

  return {
    P, USER, on: (e, f) => em.on(e, f),
    norm, split, join, parent, basename, ext, stem, display, realPath, validName, isProtected, isInside,
    get, exists: p => !!get(p), isDir: p => get(p)?.t === 'd', list, mkdir, mkdirp, write, read, rename,
    remove, removePermanent, restore, purge, emptyBin, bin: () => bin, binItem: id => bin.find(b => b.id === id),
    copy, move, unique, size: p => nodeSize(get(p)), nodeSize, countItems, walk, search, typeOf, parseLnk, drives,
    freeze() { frozen = true; },
    reset() { root = defaultTree(); bin = []; changed({}); },
  };
})();
