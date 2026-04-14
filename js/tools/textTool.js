// textTool.js — テキスト注釈（グローバル関数）
// Overlay, appState はグローバル変数として利用可能

function textHandleClick(e, page, pageIndex, state, updateSelection) {
  if (e.target.closest('.annotation')) return;
  var rect = page.overlayEl.getBoundingClientRect();
  var x = e.clientX - rect.left;
  var y = e.clientY - rect.top;
  textCreateAnnotation(x, y, page, pageIndex, state, updateSelection);
}

function textCreateAnnotation(x, y, page, pageIndex, state, updateSelection) {
  var id = genAnnId();
  var style = (state.inheritStyle && state.lastTextStyle)
    ? state.lastTextStyle
    : { fontFamily: state.fontFamily || 'Meiryo', fontSize: 16, color: '#14130F', fontWeight: '400' };
  var ann = {
    id:         id,
    pageIndex:  pageIndex,
    type:       'text',
    x:          x,
    y:          y,
    w:          0,
    h:          0,
    text:       '',
    fontSize:   style.fontSize,
    color:      style.color,
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily
  };

  page.annotations.push(ann);
  var el = textBuildElement(ann, page, pageIndex, updateSelection);
  page.overlayEl.appendChild(el);

  textEnterEdit(el, ann);
  updateSelection(pageIndex, ann);
  return ann;
}

function textBuildElement(ann, page, pageIndex, updateSelection) {
  var el = document.createElement('div');
  el.className = 'annotation text-annotation';
  el.dataset.annId = ann.id;
  textApplyStyles(el, ann);
  el.textContent = ann.text;

  el.addEventListener('mousedown', function (e) {
    e.stopPropagation();
    var tool = Overlay.getActiveTool();
    if (tool === 'delete') {
      annRemove(ann, el, page, updateSelection);
      return;
    }
    if (el.contentEditable !== 'true') {
      updateSelection(pageIndex, ann);
      annInitDrag(e, el, ann, null);
    }
  });

  el.addEventListener('dblclick', function (e) {
    e.stopPropagation();
    textEnterEdit(el, ann);
  });

  return el;
}

function textApplyStyles(el, ann) {
  el.style.left       = ann.x + 'px';
  el.style.top        = ann.y + 'px';
  el.style.fontSize   = ann.fontSize   + 'px';
  el.style.color      = ann.color;
  el.style.fontWeight = ann.fontWeight;
  el.style.fontFamily = '"' + (ann.fontFamily || 'Meiryo') + '"';
}

function textEnterEdit(el, ann) {
  el.contentEditable = 'true';
  el.focus();
  try {
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) {}

  function finish() {
    el.contentEditable = 'false';
    ann.text = el.innerText || '';
    ann.w    = el.offsetWidth;
    ann.h    = el.offsetHeight;
    el.removeEventListener('blur', finish);
  }
  el.addEventListener('blur', finish);
}
