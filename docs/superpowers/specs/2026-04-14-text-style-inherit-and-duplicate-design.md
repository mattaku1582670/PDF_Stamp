# 設計: テキスト書式引き継ぎ & 注釈複製機能

**日付:** 2026-04-14  
**対象ファイル:** `js/main.js`, `js/tools/textTool.js`, `index.html`

---

## 概要

2つの機能を追加する。

1. **書式引き継ぎ**: セッション内で新しいテキストボックスを作成するとき、直前のテキストボックスのスタイル（フォント・フォントサイズ・色・太さ）を引き継ぐ。引き継ぐかどうかはプロパティパネルのチェックボックスで切り替え可能。
2. **注釈複製**: 選択中のテキストまたは画像注釈を複製する。プロパティパネルのボタン、または Ctrl+D ショートカットで実行。

---

## 機能1: 書式引き継ぎ

### 状態管理

`appState`（`main.js`）に以下を追加する：

```js
appState.lastTextStyle = {
  fontFamily: 'Meiryo',
  fontSize:   16,
  color:      '#14130F',
  fontWeight: '400'
};
appState.inheritStyle = true;  // デフォルトON
```

### `lastTextStyle` の更新タイミング

以下のプロパティパネルイベントハンドラで、変更後に `appState.lastTextStyle` を更新する：

- `propFontFamily` の `change`
- `propFontSize` の `input`
- `propTextColor` の `input`
- `propFontWeight` の `change`

### `textCreateAnnotation()` の変更

`js/tools/textTool.js` の `textCreateAnnotation()` で、`appState.inheritStyle === true` の場合は `state.lastTextStyle` の値を初期値として使用する。`false` の場合は従来のハードコードされたデフォルト値を使用する。

```js
var style = (state.inheritStyle && state.lastTextStyle)
  ? state.lastTextStyle
  : { fontFamily: state.fontFamily || 'Meiryo', fontSize: 16, color: '#14130F', fontWeight: '400' };
```

### UI

`index.html` のテキストプロパティパネル（`#props-text`）の末尾にチェックボックスを追加する：

```html
<label class="prop-label checkbox-label">
  <input type="checkbox" id="prop-inherit-style" checked>
  次のテキストに書式を引き継ぐ
</label>
```

`main.js` でこのチェックボックスの `change` イベントを `appState.inheritStyle` に反映する。

---

## 機能2: 注釈複製

### `duplicateSelected()` 関数

`main.js` に追加する。

- 選択中の注釈（テキスト・画像両対応）のプロパティをすべてシャローコピー
- 新しい `id` を `genAnnId()` で生成
- 位置を `x + 16, y + 16` にオフセット
- 画像の場合: `bytes`/`mimeType` はそのままコピー、`url` は `URL.createObjectURL(new Blob([bytes], {type: mimeType}))` で新規生成
- 対象ページの `page.annotations` に追加
- DOM要素を生成して `page.overlayEl` に追加
  - テキスト: `textBuildElement()` を使用
  - 画像: `imageBuildElement()` を使用（後述）
- 複製後は新しい注釈を `updateSelection()` で選択状態にする

### UI（プロパティパネル）

`index.html` のテキストパネルと画像パネルの `<h3>` を、タイトルと複製ボタンを横並びにするラッパーに変更する：

```html
<!-- テキストパネル -->
<div class="props-title-row">
  <h3>テキスト</h3>
  <button class="btn-duplicate" id="duplicate-btn-text" title="複製 (Ctrl+D)">複製</button>
</div>

<!-- 画像パネル -->
<div class="props-title-row">
  <h3>画像</h3>
  <button class="btn-duplicate" id="duplicate-btn-image" title="複製 (Ctrl+D)">複製</button>
</div>
```

### キーボードショートカット

既存の `keydown` ハンドラに追加する：

```js
if (e.ctrlKey && e.key === 'd') {
  e.preventDefault();
  if (currentSelection) duplicateSelected();
}
```

編集中（`contentEditable === 'true'`、`INPUT`、`TEXTAREA`、`SELECT`）の場合は既存のガードで除外される。

### `imageTool.js` の対応

`imageBuildElement()` が現在 `imageTool.js` 内のローカル関数であれば、`duplicateSelected()` から呼べるようグローバル関数として公開する（または `main.js` 側で直接DOM構築する）。

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `js/main.js` | `appState` に `lastTextStyle`・`inheritStyle` 追加、`duplicateSelected()` 追加、各イベントハンドラ更新、`keydown` に Ctrl+D 追加 |
| `js/tools/textTool.js` | `textCreateAnnotation()` で `lastTextStyle` を使用するよう変更 |
| `js/tools/imageTool.js` | `imageBuildElement()` をグローバル公開（必要な場合） |
| `index.html` | チェックボックス・複製ボタン追加 |

---

## 考慮事項

- `lastTextStyle` はセッション内メモリのみ。PDF再読み込み時はデフォルト値にリセット。
- 複製のオフセット (+16px) はページ外にはみ出す可能性があるが、ドラッグで移動可能なため許容する。
- 画像複製時の `url` は新しい Object URL を生成するため、ページ破棄時に `cleanupPageResources()` で正しく解放される。
