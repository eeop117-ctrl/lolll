/* Фотографии */
'use strict';

Apps.register({
  id: 'photos', name: 'Фотографии', icon: 'photos', desc: 'Просмотр изображений',
  keywords: 'фото картинки изображения галерея photos',
  launch: args => openPhotos(args),
});

function openPhotos(args = {}) {
  const win = WM.open({ app: 'photos', title: 'Фотографии', width: 900, height: 620, minWidth: 420, minHeight: 300 });
  const b = win.body;
  b.classList.add('ph');
  let list = [], idx = 0, zoom = 1, rot = 0, view = args.path ? 'one' : 'grid';

  function collect(dir) {
    try { return FS.list(dir).filter(f => FS.typeOf(f.path, f.node).kind === 'image').map(f => f.path); } catch { return []; }
  }
  if (args.path) { list = collect(FS.parent(args.path)); idx = Math.max(0, list.findIndex(p => p.toLowerCase() === FS.realPath(args.path).toLowerCase())); }
  else list = collect(FS.P.pictures);

  function render() {
    if (view === 'grid') {
      list = collect(FS.P.pictures);
      win.setTitle('Фотографии');
      b.innerHTML = `<div class="ph-top"><b>Изображения</b><span class="spacer"></span><button class="btn sm ph-imp">${Icons.ui('upload', 14)} Импорт</button></div><div class="ph-grid"></div>`;
      const g = $('.ph-grid', b);
      if (!list.length) g.innerHTML = '<div class="empty-state">Нет изображений. Нажмите «Импорт».</div>';
      list.forEach((p, i) => {
        const t = h(`<div class="ph-tile" style="background-image:url('${esc(FS.read(p))}')"><span>${esc(FS.basename(p))}</span></div>`);
        t.onclick = () => { idx = i; view = 'one'; zoom = 1; rot = 0; render(); };
        g.append(t);
      });
      $('.ph-imp', b).onclick = () => FileOps.uploadInto(FS.P.pictures, 'image/*');
      return;
    }
    const p = list[idx];
    if (!p || !FS.get(p)) { view = 'grid'; return render(); }
    win.setTitle(FS.basename(p) + ' — Фотографии');
    b.innerHTML = `
      <div class="ph-top">
        <button class="icon-btn ph-back" title="Все фото">${Icons.ui('grid', 16)}</button><b class="ellip">${esc(FS.basename(p))}</b><span class="spacer"></span>
        <button class="icon-btn ph-zo">${Icons.ui('zoom-out', 16)}</button><button class="icon-btn ph-zi">${Icons.ui('zoom-in', 16)}</button>
        <button class="icon-btn ph-rot" title="Повернуть">${Icons.ui('rotate', 16)}</button>
        <button class="icon-btn ph-edit" title="Изменить в Paint">${Icons.ui('brush', 16)}</button>
        <button class="icon-btn ph-wp" title="Сделать фоном">${Icons.ui('desktop', 16)}</button>
        <button class="icon-btn ph-del" title="Удалить">${Icons.ui('trash', 16)}</button>
      </div>
      <div class="ph-stage"><img src="${esc(FS.read(p))}" style="transform:scale(${zoom}) rotate(${rot}deg)" draggable="false">
        <button class="ph-nav prev">${Icons.ui('chevron-left', 20)}</button><button class="ph-nav next">${Icons.ui('chevron-right', 20)}</button></div>
      <div class="ph-count muted small">${idx + 1} из ${list.length}</div>`;
    const step = d => { idx = (idx + d + list.length) % list.length; zoom = 1; rot = 0; render(); };
    $('.prev', b).onclick = () => step(-1);
    $('.next', b).onclick = () => step(1);
    $('.ph-back', b).onclick = () => { view = 'grid'; render(); };
    $('.ph-zi', b).onclick = () => { zoom = Math.min(5, zoom * 1.25); render(); };
    $('.ph-zo', b).onclick = () => { zoom = Math.max(0.2, zoom / 1.25); render(); };
    $('.ph-rot', b).onclick = () => { rot += 90; render(); };
    $('.ph-edit', b).onclick = () => Apps.launch('paint', { path: p });
    $('.ph-wp', b).onclick = () => FileOps.setWallpaper(p);
    $('.ph-del', b).onclick = () => { FileOps.remove([p]); list.splice(idx, 1); idx = Math.min(idx, list.length - 1); render(); };
    $('.ph-stage', b).onwheel = e => { e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.2, 5); $('.ph-stage img', b).style.transform = `scale(${zoom}) rotate(${rot}deg)`; };
  }
  win.el.addEventListener('keydown', e => {
    if (view !== 'one') return;
    if (e.key === 'ArrowLeft') $('.prev', b)?.click();
    if (e.key === 'ArrowRight') $('.next', b)?.click();
    if (e.key === 'Escape') { view = 'grid'; render(); }
  });
  win.el.tabIndex = -1;
  const off = FS.on('change', debounce(() => view === 'grid' && render(), 50));
  win.onClose = off;
  render();
  return win;
}
