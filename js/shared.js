// shared.js — 全ツールで共有するユーティリティ関数

// 一意なID生成
function genAnnId() {
  return 'ann-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

// 注釈を削除（画像の object URL も解放）
function annRemove(ann, el, page, updateSelection) {
  if (ann.type === 'image' && ann.url) URL.revokeObjectURL(ann.url);
  page.annotations = page.annotations.filter(function (a) { return a.id !== ann.id; });
  el.remove();
  updateSelection(null, null);
}

// ドラッグ開始（テキスト・画像共通）
function annInitDrag(startEvent, el, ann, onEnd) {
  startEvent.preventDefault();
  var startX = startEvent.clientX;
  var startY = startEvent.clientY;
  var origX  = ann.x;
  var origY  = ann.y;
  var moved  = false;

  function onMove(e) {
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 3) return;
    moved       = true;
    ann.x       = origX + dx;
    ann.y       = origY + dy;
    el.style.left = ann.x + 'px';
    el.style.top  = ann.y + 'px';
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    if (moved && onEnd) onEnd();
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}
