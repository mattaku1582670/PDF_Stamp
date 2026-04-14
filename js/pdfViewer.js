// pdfViewer.js — PDF.js で全ページを canvas にレンダリング
// pdfjsLib は lib/pdf.min.js でグローバルに定義済み

async function renderPDF(pdfBytes, container) {
  var lib = window.pdfjsLib;
  if (!lib) throw new Error('PDF.js が読み込まれていません。');

  // .slice() でコピーを渡す — PDF.js Worker が ArrayBuffer を transfer して
  // 元バッファを detach するため、appState.pdfBytes を保護する
  var loadingTask = lib.getDocument({ data: pdfBytes.slice() });
  var pdf = await loadingTask.promise;
  var pages = [];

  var containerW = container.clientWidth > 0 ? container.clientWidth - 48 : 760;

  for (var i = 1; i <= pdf.numPages; i++) {
    var page = await pdf.getPage(i);

    var rawVP = page.getViewport({ scale: 1 });
    var scale = Math.min(containerW / rawVP.width, 2);
    var viewport = page.getViewport({ scale: scale });

    // ページラッパー
    var wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';
    wrapper.style.width  = viewport.width  + 'px';
    wrapper.style.height = viewport.height + 'px';
    wrapper.style.animationDelay = ((i - 1) * 55) + 'ms';

    // Canvas（HiDPI対応）
    var canvas = document.createElement('canvas');
    var dpr = window.devicePixelRatio || 1;
    canvas.width  = Math.floor(viewport.width  * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width  = viewport.width  + 'px';
    canvas.style.height = viewport.height + 'px';

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // オーバーレイ
    var overlayEl = document.createElement('div');
    overlayEl.className = 'page-overlay tool-select';

    wrapper.appendChild(canvas);
    wrapper.appendChild(overlayEl);
    container.appendChild(wrapper);

    pages.push({
      canvas:      canvas,
      viewport:    viewport,
      scale:       scale,
      overlayEl:   overlayEl,
      annotations: []
    });
  }

  return pages;
}
