# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 実行方法

ビルド不要。`index.html` をブラウザで直接開くだけで動作する。

```
# ローカルサーバーが使える場合（開発時）
python -m http.server 8910
# → http://localhost:8910 を開く

# オフライン・サーバーなしの場合
# index.html をダブルクリック（Chrome / Edge 推奨）
```

ビルド・トランスパイル・npm は一切使わない。

## ライブラリの更新・追加

外部ライブラリは `lib/` に UMD ビルドをローカル保存している（オフライン動作のため CDN 不可）。更新時は Node.js でダウンロード：

```js
// 社内ネットワーク（SSL インスペクション）対応
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
// ... download() で lib/ に保存
```

現在のバージョン：
- `pdfjs-dist@3.11.174` — PDF 表示（UMD: `pdf.min.js` + `pdf.worker.min.js`）
- `pdf-lib@1.17.1` — PDF 書き出し
- `@pdf-lib/fontkit@1.1.0` — 日本語フォント埋め込みに必須

## アーキテクチャ

### スクリプト読み込み順（index.html で固定）

```
lib/pdf.min.js       → window.pdfjsLib
lib/pdf-lib.min.js   → window.PDFLib
lib/fontkit.umd.min.js → window.fontkit
js/shared.js         → genAnnId(), annRemove(), annInitDrag()
js/overlay.js        → Overlay.getActiveTool() / setActiveTool()
js/pdfViewer.js      → renderPDF()
js/tools/textTool.js → textHandleClick(), textCreateAnnotation()
js/tools/imageTool.js → imageHandleInsert()
js/exporter.js       → exportPDF()
js/main.js           → エントリポイント（appState, updateSelection, イベント）
```

ES モジュール（`import/export`）は使わない。全関数はグローバルスコープで前のスクリプトを参照する。

### 状態モデル

`appState`（`main.js` のグローバル変数）が唯一の状態：

```js
appState = {
  pdfBytes:  Uint8Array,   // 元 PDF（編集中も変更しない）
  fileName:  string,
  pages:     [PageData],   // renderPDF() が返す配列
  fontBytes: Uint8Array,   // ユーザーが読み込んだ日本語フォント
}

PageData = {
  canvas, viewport, scale,  // PDF.js の描画情報
  overlayEl: HTMLDivElement, // 注釈 DOM の親
  annotations: [Annotation]  // 状態の真実（DOM と同期）
}

Annotation = {
  id, pageIndex, type: 'text'|'image',
  x, y, w, h,           // overlay DOM座標 (px)
  // text: text, fontSize, color, fontWeight
  // image: bytes, mimeType, url, opacity, aspectRatio
}
```

### 座標変換（DOM → PDF）

PDF.js は scale 倍で canvas に描画する。オーバーレイは canvas と同サイズの CSS px で重なる。

```
pdfX = ann.x / scale
pdfY = pdfPage.getHeight() - (ann.y + ann.h) / scale   // PDF は左下原点
```

テキストはベースラインを `ann.y + ann.fontSize` 付近として近似。

### ツールシステム

`Overlay.setActiveTool(tool)` がすべての `.page-overlay` に `tool-{name}` クラスを付与し、cursor スタイルを切り替える。各ページの `click` イベントハンドラ（`setupPageInteractions` で登録）がツール名で分岐して各 Tool 関数を呼ぶ。

ツール関数は `updateSelection` コールバックを受け取り、`main.js` の選択状態を更新する。

### 日本語フォント

pdf-lib の標準フォント（Helvetica 等）は日本語を描画できない。ユーザーが OTF/TTF を手動で読み込んだ場合のみ `appState.fontBytes` に格納され、`exportPDF` 時に `pdfDoc.embedFont(..., { subset: true })` で埋め込む。フォント未読み込み時は Helvetica にフォールバック（英数のみ正常）。

## 新しいツールを追加する場合

1. `js/tools/fooTool.js` を作成（グローバル関数として `fooHandleXxx()` を定義）
2. `index.html` の `<script>` リストに `main.js` より前に追加
3. `main.js` の `setupPageInteractions()` 内に `tool === 'foo'` の分岐を追加
4. `index.html` にツールボタン（`data-tool="foo"`）を追加
