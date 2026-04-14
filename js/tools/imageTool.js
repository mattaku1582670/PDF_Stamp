// imageTool.js — 画像注釈（グローバル関数）

var _imagePicking = false;

function imageHandleInsert(page, pageIndex, state, updateSelection) {
  if (_imagePicking) return;
  _imagePicking = true;

  var input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/png,image/jpeg,image/jpg';

  input.onchange = async function () {
    _imagePicking = false;
    var file = input.files[0];
    if (!file) return;

    var bytes    = new Uint8Array(await file.arrayBuffer());
    var mimeType = (file.type === 'image/jpg') ? 'image/jpeg' : file.type;
    var url      = URL.createObjectURL(new Blob([bytes], { type: mimeType }));

    var defaultW = Math.min(200, page.viewport.width * 0.4);
    var id       = genAnnId();
    var ann = {
      id:          id,
      pageIndex:   pageIndex,
      type:        'image',
      x:           Math.max(0, page.viewport.width  / 2 - defaultW / 2),
      y:           Math.max(0, page.viewport.height / 2 - defaultW * 0.375),
      w:           defaultW,
      h:           defaultW * 0.75,
      bytes:       bytes,
      mimeType:    mimeType,
      url:         url,
      opacity:     1,
      aspectRatio: null
    };

    page.annotations.push(ann);
    var el = imageBuildElement(ann, page, pageIndex, updateSelection);
    page.overlayEl.appendChild(el);
    updateSelection(pageIndex, ann);
  };

  input.oncancel = function () { _imagePicking = false; };
  setTimeout(function () { _imagePicking = false; }, 10000);
  input.click();
}

function imageBuildElement(ann, page, pageIndex, updateSelection) {
  var el = document.createElement('div');
  el.className     = 'annotation image-annotation';
  el.dataset.annId = ann.id;
  el.style.cssText = 'left:' + ann.x + 'px; top:' + ann.y + 'px; width:' + ann.w + 'px; height:' + ann.h + 'px; opacity:' + ann.opacity + ';';

  var img  = document.createElement('img');
  img.src  = ann.url;
  img.alt  = '';
  img.onload = function () {
    if (img.naturalWidth > 0) {
      var ratio      = img.naturalHeight / img.naturalWidth;
      ann.aspectRatio = ratio;
      ann.h           = ann.w * ratio;
      el.style.height = ann.h + 'px';
      imageSyncProps(ann);
    }
  };

  // リサイズハンドル
  var handlesEl = document.createElement('div');
  handlesEl.className = 'resize-handles';
  ['nw','n','ne','e','se','s','sw','w'].forEach(function (dir) {
    var h = document.createElement('div');
    h.className   = 'resize-handle';
    h.dataset.dir = dir;
    handlesEl.appendChild(h);
    h.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      e.preventDefault();
      imageStartResize(e, dir, ann, el, updateSelection, pageIndex);
    });
  });

  el.appendChild(img);
  el.appendChild(handlesEl);

  el.addEventListener('mousedown', function (e) {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();
    var tool = Overlay.getActiveTool();
    if (tool === 'delete') {
      annRemove(ann, el, page, updateSelection);
      return;
    }
    updateSelection(pageIndex, ann);
    annInitDrag(e, el, ann, null);
  });

  return el;
}

function imageStartResize(e, dir, ann, el, updateSelection, pageIndex) {
  var startX = e.clientX, startY = e.clientY;
  var origX  = ann.x, origY = ann.y, origW = ann.w, origH = ann.h;
  var ratio  = ann.aspectRatio || (origH / origW) || 1;

  function onMove(ev) {
    var lockAspect = ev.shiftKey || (document.getElementById('prop-aspect-lock') ? document.getElementById('prop-aspect-lock').checked : true);
    var dx = ev.clientX - startX, dy = ev.clientY - startY;
    var newX = origX, newY = origY, newW = origW, newH = origH;

    if (dir.indexOf('e') >= 0) newW = Math.max(20, origW + dx);
    if (dir.indexOf('s') >= 0) newH = Math.max(20, origH + dy);
    if (dir.indexOf('w') >= 0) { newW = Math.max(20, origW - dx); newX = origX + (origW - newW); }
    if (dir.indexOf('n') >= 0) { newH = Math.max(20, origH - dy); newY = origY + (origH - newH); }

    if (lockAspect) {
      if (dir === 'n' || dir === 's') {
        newW = newH / ratio;
        if (dir === 'n') newY = origY + origH - newH;
      } else if (dir === 'e' || dir === 'w') {
        newH = newW * ratio;
        if (dir === 'w') newX = origX + origW - newW;
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) {
          newH = newW * ratio;
          if (dir.indexOf('n') >= 0) newY = origY + origH - newH;
        } else {
          newW = newH / ratio;
          if (dir.indexOf('w') >= 0) newX = origX + origW - newW;
        }
      }
    }

    ann.x = newX; ann.y = newY; ann.w = newW; ann.h = newH;
    el.style.left   = newX + 'px';
    el.style.top    = newY + 'px';
    el.style.width  = newW + 'px';
    el.style.height = newH + 'px';
    imageSyncProps(ann);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
    updateSelection(pageIndex, ann);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
}

function imageSyncProps(ann) {
  var wEl = document.getElementById('prop-img-width');
  var hEl = document.getElementById('prop-img-height');
  if (wEl) wEl.value = Math.round(ann.w);
  if (hEl) hEl.value = Math.round(ann.h);
}
