// exporter.js — pdf-lib で注釈を元 PDF に焼き込んでダウンロード
// テキスト注釈はキャンバスでレンダリングして PNG 画像として埋め込む

async function exportPDF(state) {
  var PDFLib = window.PDFLib;
  if (!PDFLib)          throw new Error('pdf-lib が読み込まれていません。');
  if (!state.pdfBytes)  throw new Error('PDF が読み込まれていません。');

  var pdfDoc   = await PDFLib.PDFDocument.load(state.pdfBytes);
  var pdfPages = pdfDoc.getPages();

  for (var pi = 0; pi < state.pages.length; pi++) {
    var pageData = state.pages[pi];
    if (!pageData.annotations || pageData.annotations.length === 0) continue;

    var pdfPage = pdfPages[pi];
    if (!pdfPage) continue;

    for (var ai = 0; ai < pageData.annotations.length; ai++) {
      var ann = pageData.annotations[ai];
      if (ann.type === 'text') {
        await exportTextAnn(pdfPage, pageData, ann, pdfDoc);
      } else if (ann.type === 'image') {
        await exportImageAnn(pdfPage, pageData, ann, pdfDoc);
      }
    }
  }

  var outBytes = await pdfDoc.save();
  var filename = state.fileName.replace(/\.pdf$/i, '') + '_edited.pdf';
  exportDownload(outBytes, filename);
  return null;
}

// overlay の CSS 座標（左上原点）→ PDF 座標変換
// viewport.convertToPdfPoint を使うことで回転・crop のある PDF でも正確に変換できる
function overlayRectToPdfRect(pageData, ann) {
  var vp = pageData.viewport;
  var p1 = vp.convertToPdfPoint(ann.x,           ann.y);
  var p2 = vp.convertToPdfPoint(ann.x + ann.w,   ann.y + ann.h);
  return {
    x:      Math.min(p1[0], p2[0]),
    y:      Math.min(p1[1], p2[1]),
    width:  Math.abs(p2[0] - p1[0]),
    height: Math.abs(p2[1] - p1[1])
  };
}

// テキスト注釈をキャンバスでレンダリングして PNG として埋め込む
async function exportTextAnn(pdfPage, pageData, ann, pdfDoc) {
  var el = document.querySelector('[data-ann-id="' + ann.id + '"]');
  if (el) {
    // \r\n を正規化してから格納
    ann.text = el.innerText.replace(/\r\n?/g, '\n') || ann.text;
    ann.w    = el.offsetWidth  || ann.w;
    ann.h    = el.offsetHeight || ann.h;
  }

  if (!(ann.text || '').trim()) return;

  var bytes = await exportTextToImageBytes(ann, el);
  if (!bytes) return;

  var embeddedImage;
  try {
    embeddedImage = await pdfDoc.embedPng(bytes);
  } catch (e) {
    console.warn('テキスト画像の埋め込み失敗:', e.message);
    return;
  }

  var rect = overlayRectToPdfRect(pageData, ann);
  pdfPage.drawImage(embeddedImage, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

// テキスト注釈をオフスクリーンキャンバスに描画して PNG バイト列を返す
// el が存在する場合は getComputedStyle を使って DOM 表示と完全に一致させる
async function exportTextToImageBytes(ann, el) {
  var w = Math.ceil(ann.w) || 200;
  var h = Math.ceil(ann.h) || 50;
  var dpr = Math.max(2, window.devicePixelRatio || 1);

  var canvas = document.createElement('canvas');
  canvas.width  = Math.max(1, Math.ceil(w * dpr));
  canvas.height = Math.max(1, Math.ceil(h * dpr));

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var fontStr, lineH, px, py, fillColor;

  if (el) {
    // DOM の実スタイルを使う（フォント・行高・パディングの二重管理を排除）
    var style = getComputedStyle(el);
    fontStr   = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    lineH     = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineH)) lineH = (parseFloat(style.fontSize) || 16) * 1.35;
    px        = parseFloat(style.paddingLeft) || 0;
    py        = parseFloat(style.paddingTop)  || 0;
    fillColor = style.color;
    // フォントが未ロードの場合に備えて待機
    try { await document.fonts.load(fontStr, ann.text || 'あ'); } catch (_) {}
  } else {
    // DOM が消えている場合は annotation の値で代替
    var fontSize   = ann.fontSize   || 16;
    var fontFamily = ann.fontFamily || 'sans-serif';
    var fontWeight = ann.fontWeight || '400';
    fontStr   = fontWeight + ' ' + fontSize + 'px "' + fontFamily + '"';
    lineH     = fontSize * 1.35;
    px = 2; py = 1;
    fillColor = ann.color || '#14130F';
  }

  ctx.font         = fontStr;
  ctx.fillStyle    = fillColor;
  ctx.textBaseline = 'top';

  (ann.text || '').split('\n').forEach(function (line, i) {
    if (line) ctx.fillText(line, px, py + i * lineH);
  });

  return new Promise(function (resolve) {
    canvas.toBlob(function (blob) {
      if (!blob) { resolve(null); return; }
      blob.arrayBuffer().then(function (buf) { resolve(new Uint8Array(buf)); });
    }, 'image/png');
  });
}

async function exportImageAnn(pdfPage, pageData, ann, pdfDoc) {
  if (!ann.bytes || ann.bytes.length === 0) return;

  var embeddedImage;
  try {
    embeddedImage = ann.mimeType === 'image/png'
      ? await pdfDoc.embedPng(ann.bytes)
      : await pdfDoc.embedJpg(ann.bytes);
  } catch (e) {
    console.warn('画像埋め込み失敗:', e.message);
    return;
  }

  var rect = overlayRectToPdfRect(pageData, ann);
  pdfPage.drawImage(embeddedImage, {
    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
    opacity: ann.opacity != null ? ann.opacity : 1
  });
}

function exportDownload(bytes, filename) {
  var blob = new Blob([bytes], { type: 'application/pdf' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
}
