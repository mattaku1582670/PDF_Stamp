// main.js — アプリ起動・状態管理・イベント統合
// 全ての依存ファイルは script タグで先に読み込まれている前提

var appState = {
  pdfBytes:      null,
  fileName:      '',
  pages:         [],
  fontFamily:    'Meiryo',
  inheritStyle:  true,
  lastTextStyle: {
    fontFamily: 'Meiryo',
    fontSize:   16,
    color:      '#14130F',
    fontWeight: '400'
  }
};

// ============================================================
// フォントプリセット（Font Access API が使えない環境向け）
// ============================================================
var FONT_PRESETS = [
  'Meiryo',
  'Yu Gothic',
  'BIZ UDGothic',
  'MS PGothic',
  'MS Gothic',
  'Yu Mincho',
  'MS PMincho',
  'BIZ UDMincho',
  'Arial',
  'Times New Roman',
  'Courier New'
];

// ============================================================
// DOM 参照
// ============================================================
var pdfInput        = document.getElementById('pdf-input');
var openBtn         = document.getElementById('open-btn');
var saveBtn         = document.getElementById('save-btn');
var fontFamilySelect = document.getElementById('font-family-select');
var filenameDisp    = document.getElementById('filename-display');
var canvasArea      = document.getElementById('canvas-area');
var dropHint        = document.getElementById('drop-hint');
var dropOpenBtn     = document.getElementById('drop-open-btn');
var pagesContainer  = document.getElementById('pages-container');

var toolBtns  = document.querySelectorAll('.tool-btn[data-tool]');
var deleteBtn = document.getElementById('delete-btn');

var propsEmpty = document.getElementById('props-empty');
var propsText  = document.getElementById('props-text');
var propsImage = document.getElementById('props-image');

var propTextContent  = document.getElementById('prop-text-content');
var propFontFamily   = document.getElementById('prop-font-family');
var propFontSize     = document.getElementById('prop-font-size');
var propTextColor    = document.getElementById('prop-text-color');
var propFontWeight   = document.getElementById('prop-font-weight');
var propImgWidth     = document.getElementById('prop-img-width');
var propImgHeight    = document.getElementById('prop-img-height');
var propAspectLock   = document.getElementById('prop-aspect-lock');
var propOpacity      = document.getElementById('prop-opacity');
var propOpacityVal   = document.getElementById('prop-opacity-val');
var propInheritStyle = document.getElementById('prop-inherit-style');
var duplicateBtnText  = document.getElementById('duplicate-btn-text');
var duplicateBtnImage = document.getElementById('duplicate-btn-image');

// ============================================================
// フォント選択
// ============================================================

// フォントリストを構築して select に追加する共通処理
function populateFontSelect(selectEl, fonts) {
  selectEl.innerHTML = '';
  fonts.forEach(function (name) {
    var opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    opt.style.fontFamily = '"' + name + '"';
    selectEl.appendChild(opt);
  });
}

// Font Access API でシステムフォント一覧を取得（Chrome/Edge 103+）
// 失敗時はプリセットにフォールバック
async function loadFontList() {
  var fonts = FONT_PRESETS.slice();

  if (typeof window.queryLocalFonts === 'function') {
    try {
      var localFonts = await window.queryLocalFonts();
      var families = [];
      var seen = {};
      localFonts.forEach(function (f) {
        if (!seen[f.family]) { seen[f.family] = true; families.push(f.family); }
      });
      families.sort(function (a, b) { return a.localeCompare(b, 'ja'); });
      fonts = families;
    } catch (e) {
      // 権限拒否またはAPI非対応 → プリセットを使用
      console.info('Font Access API 未許可。プリセットフォントを使用します。');
    }
  }

  return fonts;
}

// 初期化: フォントリストをヘッダーセレクトと props パネルに設定
(async function initFonts() {
  var fonts = await loadFontList();

  populateFontSelect(fontFamilySelect, fonts);
  fontFamilySelect.value = appState.fontFamily;
  if (!fontFamilySelect.value && fonts.length > 0) {
    fontFamilySelect.value = fonts[0];
    appState.fontFamily = fonts[0];
  }

  // props パネルのフォントセレクトも同じリストで初期化
  populateFontSelect(propFontFamily, fonts);
})();

// ヘッダーのフォント変更 → 以降に作成する注釈の既定フォントを更新
fontFamilySelect.addEventListener('change', function () {
  appState.fontFamily = fontFamilySelect.value;
  // 選択中のテキスト注釈があれば即時反映
  if (currentSelection && currentSelection.annotation.type === 'text') {
    var ann = currentSelection.annotation;
    ann.fontFamily = appState.fontFamily;
    currentSelection.element.style.fontFamily = '"' + ann.fontFamily + '"';
    propFontFamily.value = ann.fontFamily;
  }
});

// ============================================================
// PDF を開く
// ============================================================
openBtn.addEventListener('click',     function () { pdfInput.click(); });
dropOpenBtn.addEventListener('click', function () { pdfInput.click(); });
pdfInput.addEventListener('change', function (e) {
  if (e.target.files[0]) loadPDF(e.target.files[0]);
  pdfInput.value = '';
});

canvasArea.addEventListener('dragover', function (e) {
  e.preventDefault();
  canvasArea.classList.add('drag-over');
});
canvasArea.addEventListener('dragleave', function () {
  canvasArea.classList.remove('drag-over');
});
canvasArea.addEventListener('drop', function (e) {
  e.preventDefault();
  canvasArea.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') loadPDF(file);
});

// ページ内の画像 object URL を一括解放
function cleanupPageResources(pages) {
  if (!pages) return;
  pages.forEach(function (page) {
    (page.annotations || []).forEach(function (ann) {
      if (ann.type === 'image' && ann.url) URL.revokeObjectURL(ann.url);
    });
  });
}

// 連続 Open 時の race 対策: バージョン番号で古い非同期結果を破棄
var _loadVersion = 0;

async function loadPDF(file) {
  var ver = ++_loadVersion;
  saveBtn.disabled = true;
  showToast('読み込み中…');

  // 既存ページの object URL を解放してから DOM をクリア
  cleanupPageResources(appState.pages);
  pagesContainer.innerHTML = '';
  currentSelection = null;
  showPropsPanel('empty');
  dropHint.classList.add('hidden');
  filenameDisp.textContent = file.name;

  try {
    var bytes = new Uint8Array(await file.arrayBuffer());
    var pages = await renderPDF(bytes, pagesContainer);

    // 後続の loadPDF が走っていたら結果を捨てる
    if (ver !== _loadVersion) return;

    appState.pdfBytes = bytes;
    appState.fileName = file.name;
    appState.pages    = pages;

    Overlay.setActiveTool(Overlay.getActiveTool());
    setupPageInteractions();
    saveBtn.disabled = false;
    showToast(file.name + ' を開きました（' + pages.length + ' ページ）');
  } catch (err) {
    if (ver !== _loadVersion) return;
    console.error(err);
    showToast('エラー: ' + err.message);
    dropHint.classList.remove('hidden');
  }
}

// ============================================================
// ページインタラクション設定
// ============================================================
function setupPageInteractions() {
  appState.pages.forEach(function (page, pageIndex) {
    page.overlayEl.addEventListener('click', function (e) {
      var tool = Overlay.getActiveTool();

      if (tool === 'text') {
        if (e.target.closest('.annotation')) return;
        textHandleClick(e, page, pageIndex, appState, updateSelection);

      } else if (tool === 'image') {
        if (e.target.closest('.annotation')) return;
        imageHandleInsert(page, pageIndex, appState, updateSelection);

      } else if (tool === 'select') {
        if (!e.target.closest('.annotation')) updateSelection(null, null);

      } else if (tool === 'delete') {
        if (!e.target.closest('.annotation')) updateSelection(null, null);
      }
    });
  });
}

// ============================================================
// ツール切替
// ============================================================
toolBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    toolBtns.forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    Overlay.setActiveTool(btn.dataset.tool);
    if (btn.dataset.tool !== 'select') updateSelection(null, null);
  });
});

document.addEventListener('keydown', function (e) {
  var tag      = document.activeElement && document.activeElement.tagName;
  var editable = document.activeElement && document.activeElement.contentEditable === 'true';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;

  if (e.ctrlKey && e.key === 'd') {
    e.preventDefault();
    if (currentSelection) duplicateSelected();
    return;
  }

  var map = { v: 'select', t: 'text', i: 'image' };
  var key = e.key.toLowerCase();
  if (map[key]) {
    var btn = document.querySelector('.tool-btn[data-tool="' + map[key] + '"]');
    if (btn) btn.click();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (currentSelection) deleteSelected();
  }
  if (e.key === 'Escape') {
    updateSelection(null, null);
  }
});

deleteBtn.addEventListener('click', function () {
  if (currentSelection) deleteSelected();
});
duplicateBtnText.addEventListener('click',  function () { if (currentSelection) duplicateSelected(); });
duplicateBtnImage.addEventListener('click', function () { if (currentSelection) duplicateSelected(); });

// ============================================================
// 選択状態管理
// ============================================================
var currentSelection = null;

function updateSelection(pageIndex, annotation) {
  if (currentSelection && currentSelection.element) {
    currentSelection.element.classList.remove('selected');
  }

  if (annotation === null) {
    currentSelection = null;
    showPropsPanel('empty');
    return;
  }

  var page = appState.pages[pageIndex];
  var el   = page && page.overlayEl.querySelector('[data-ann-id="' + annotation.id + '"]');
  if (el) el.classList.add('selected');

  currentSelection = { pageIndex: pageIndex, annotation: annotation, element: el };

  if (annotation.type === 'text') {
    showPropsPanel('text');
    fillTextProps(annotation);
  } else {
    showPropsPanel('image');
    fillImageProps(annotation);
  }
}

function showPropsPanel(type) {
  propsEmpty.hidden = (type !== 'empty');
  propsText .hidden = (type !== 'text');
  propsImage.hidden = (type !== 'image');
}

function deleteSelected() {
  if (!currentSelection) return;
  var pageIndex  = currentSelection.pageIndex;
  var annotation = currentSelection.annotation;
  var element    = currentSelection.element;
  var page       = appState.pages[pageIndex];
  if (annotation.type === 'image' && annotation.url) URL.revokeObjectURL(annotation.url);
  page.annotations = page.annotations.filter(function (a) { return a.id !== annotation.id; });
  element.remove();
  currentSelection = null;
  showPropsPanel('empty');
}

function duplicateSelected() {
  if (!currentSelection) return;
  var src       = currentSelection.annotation;
  var pageIndex = currentSelection.pageIndex;
  var page      = appState.pages[pageIndex];

  var newAnn = Object.assign({}, src, {
    id: genAnnId(),
    x:  src.x + 16,
    y:  src.y + 16
  });

  if (src.type === 'image') {
    newAnn.url = URL.createObjectURL(new Blob([src.bytes], { type: src.mimeType }));
  }

  page.annotations.push(newAnn);

  var el;
  if (src.type === 'text') {
    el = textBuildElement(newAnn, page, pageIndex, updateSelection);
  } else {
    el = imageBuildElement(newAnn, page, pageIndex, updateSelection);
  }
  page.overlayEl.appendChild(el);
  updateSelection(pageIndex, newAnn);
}

// ============================================================
// プロパティパネル — 値反映
// ============================================================
function fillTextProps(ann) {
  propTextContent.value    = ann.text       || '';
  propFontFamily.value     = ann.fontFamily || appState.fontFamily;
  propFontSize.value       = ann.fontSize   || 16;
  propTextColor.value      = ann.color      || '#14130F';
  propFontWeight.value     = ann.fontWeight || '400';
  propInheritStyle.checked = appState.inheritStyle;
}

function fillImageProps(ann) {
  propImgWidth.value  = Math.round(ann.w);
  propImgHeight.value = Math.round(ann.h);
  propOpacity.value   = ann.opacity != null ? ann.opacity : 1;
  propOpacityVal.textContent = Math.round((ann.opacity != null ? ann.opacity : 1) * 100) + '%';
}

// ============================================================
// プロパティパネル — 変更を注釈へ反映
// ============================================================
propTextContent.addEventListener('input', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.text = propTextContent.value;
  currentSelection.element.textContent = ann.text;
});

propFontFamily.addEventListener('change', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.fontFamily = propFontFamily.value;
  currentSelection.element.style.fontFamily = '"' + ann.fontFamily + '"';
  fontFamilySelect.value = ann.fontFamily;
  appState.fontFamily    = ann.fontFamily;
  appState.lastTextStyle.fontFamily = ann.fontFamily;
});

propFontSize.addEventListener('input', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.fontSize = +propFontSize.value;
  var el = currentSelection.element;
  el.style.fontSize = ann.fontSize + 'px';
  ann.w = el.offsetWidth;
  ann.h = el.offsetHeight;
  appState.lastTextStyle.fontSize = ann.fontSize;
});

propTextColor.addEventListener('input', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.color = propTextColor.value;
  currentSelection.element.style.color = ann.color;
  appState.lastTextStyle.color = ann.color;
});

propFontWeight.addEventListener('change', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.fontWeight = propFontWeight.value;
  currentSelection.element.style.fontWeight = ann.fontWeight;
  appState.lastTextStyle.fontWeight = ann.fontWeight;
});

propInheritStyle.addEventListener('change', function () {
  appState.inheritStyle = propInheritStyle.checked;
});

propImgWidth.addEventListener('input', function () {
  if (!isSel('image')) return;
  var ann  = currentSelection.annotation;
  var newW = Math.max(10, +propImgWidth.value);
  if (propAspectLock.checked && ann.aspectRatio) {
    ann.h = newW * ann.aspectRatio;
    propImgHeight.value = Math.round(ann.h);
  }
  ann.w = newW;
  var el = currentSelection.element;
  el.style.width  = ann.w + 'px';
  el.style.height = ann.h + 'px';
});

propImgHeight.addEventListener('input', function () {
  if (!isSel('image')) return;
  var ann  = currentSelection.annotation;
  var newH = Math.max(10, +propImgHeight.value);
  if (propAspectLock.checked && ann.aspectRatio) {
    ann.w = newH / ann.aspectRatio;
    propImgWidth.value = Math.round(ann.w);
  }
  ann.h = newH;
  var el = currentSelection.element;
  el.style.width  = ann.w + 'px';
  el.style.height = ann.h + 'px';
});

propOpacity.addEventListener('input', function () {
  if (!isSel('image')) return;
  var ann = currentSelection.annotation;
  ann.opacity = +propOpacity.value;
  propOpacityVal.textContent = Math.round(ann.opacity * 100) + '%';
  currentSelection.element.style.opacity = ann.opacity;
});

function isSel(type) {
  return currentSelection && currentSelection.annotation.type === type;
}

// ============================================================
// 保存
// ============================================================
saveBtn.addEventListener('click', async function () {
  if (!appState.pdfBytes) return;
  saveBtn.disabled = true;
  showToast('保存中…');
  try {
    var warn = await exportPDF(appState);
    showToast(warn ? '保存完了（警告: ' + warn + '）' : '保存完了！');
  } catch (err) {
    console.error(err);
    showToast('保存エラー: ' + err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ============================================================
// トースト
// ============================================================
var _toastTimer;
function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
}
