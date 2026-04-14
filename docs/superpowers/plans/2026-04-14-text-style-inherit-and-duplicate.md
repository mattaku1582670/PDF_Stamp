# テキスト書式引き継ぎ & 注釈複製 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テキストボックス作成時に直前のスタイルを引き継ぐ機能と、選択中の注釈（テキスト・画像）を複製する機能を追加する。

**Architecture:** `appState` に `lastTextStyle`・`inheritStyle` を追加し、既存イベントハンドラで自動更新する。複製は `duplicateSelected()` を `main.js` に追加して、ボタンと Ctrl+D から呼び出す。

**Tech Stack:** Vanilla JS, HTML, CSS（ビルド不要、ブラウザで直接動作）

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `js/main.js` | `appState` 拡張、イベントハンドラ更新、`duplicateSelected()` 追加、Ctrl+D 追加 |
| `js/tools/textTool.js` | `textCreateAnnotation()` で `lastTextStyle` を使用 |
| `index.html` | チェックボックス・複製ボタン追加、ショートカット一覧更新 |
| `css/style.css` | `.props-title-row`・`.btn-duplicate` スタイル追加 |

---

## Task 1: 書式引き継ぎ — 状態管理と textCreateAnnotation の変更

**Files:**
- Modify: `js/main.js` (lines 4-9 — appState 定義)
- Modify: `js/tools/textTool.js` (lines 12-36 — textCreateAnnotation)

- [ ] **Step 1: appState に lastTextStyle と inheritStyle を追加**

`js/main.js` の `appState` 定義（1〜9行目）を以下に置き換える：

```js
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
```

- [ ] **Step 2: textCreateAnnotation() を lastTextStyle 参照に変更**

`js/tools/textTool.js` の `textCreateAnnotation()` 関数（12〜36行目）を以下に置き換える：

```js
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
```

- [ ] **Step 3: ブラウザで動作確認**

1. `index.html` をブラウザで開き、PDFを読み込む
2. テキストツール (T) でクリックしてテキストボックスを作成し、文字を入力して Esc
3. プロパティパネルでフォントサイズを 24px に変更する
4. 再度テキストツールでクリックして新しいテキストボックスを作成
5. **期待値**: 新しいテキストボックスのフォントサイズが 24px になっていること

- [ ] **Step 4: コミット**

```bash
git add js/main.js js/tools/textTool.js
git commit -m "feat: appState に書式引き継ぎ状態を追加し textCreateAnnotation を更新"
```

---

## Task 2: 書式引き継ぎ — UI とイベントハンドラ

**Files:**
- Modify: `index.html` (props-text パネル末尾)
- Modify: `js/main.js` (DOM参照、イベントハンドラ群)

- [ ] **Step 1: index.html にチェックボックスを追加**

`index.html` の `#props-text` の末尾（`</div>` の直前、`propFontWeight` の `<label>` の後）にチェックボックスを追加する。

変更前（109〜137行目付近）の末尾部分：
```html
        <label class="prop-label">
          太さ
          <select id="prop-font-weight">
            <option value="400">Regular</option>
            <option value="700">Bold</option>
          </select>
        </label>
      </div>
```

変更後：
```html
        <label class="prop-label">
          太さ
          <select id="prop-font-weight">
            <option value="400">Regular</option>
            <option value="700">Bold</option>
          </select>
        </label>
        <label class="prop-label checkbox-label" style="margin-top:4px; margin-bottom:0">
          <input type="checkbox" id="prop-inherit-style" checked>
          次のテキストに書式を引き継ぐ
        </label>
      </div>
```

- [ ] **Step 2: main.js に propInheritStyle の DOM 参照を追加**

`js/main.js` の DOM 参照セクション（31〜57行目付近）の末尾に追加する。

`propOpacityVal` の行の直後：
```js
var propOpacityVal   = document.getElementById('prop-opacity-val');
```
↓ この行の直後に追加：
```js
var propInheritStyle = document.getElementById('prop-inherit-style');
```

- [ ] **Step 3: プロパティパネルの各イベントハンドラで lastTextStyle を更新**

`js/main.js` の `propFontFamily` の `change` イベントハンドラを以下に置き換える（339〜347行目付近）：

```js
propFontFamily.addEventListener('change', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.fontFamily = propFontFamily.value;
  currentSelection.element.style.fontFamily = '"' + ann.fontFamily + '"';
  fontFamilySelect.value = ann.fontFamily;
  appState.fontFamily    = ann.fontFamily;
  appState.lastTextStyle.fontFamily = ann.fontFamily;
});
```

`propFontSize` の `input` イベントハンドラを以下に置き換える（349〜357行目付近）：

```js
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
```

`propTextColor` の `input` イベントハンドラを以下に置き換える（359〜364行目付近）：

```js
propTextColor.addEventListener('input', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.color = propTextColor.value;
  currentSelection.element.style.color = ann.color;
  appState.lastTextStyle.color = ann.color;
});
```

`propFontWeight` の `change` イベントハンドラを以下に置き換える（366〜371行目付近）：

```js
propFontWeight.addEventListener('change', function () {
  if (!isSel('text')) return;
  var ann = currentSelection.annotation;
  ann.fontWeight = propFontWeight.value;
  currentSelection.element.style.fontWeight = ann.fontWeight;
  appState.lastTextStyle.fontWeight = ann.fontWeight;
});
```

- [ ] **Step 4: チェックボックスの change イベントを追加**

`js/main.js` の `propFontWeight` の `change` イベントハンドラの直後に以下を追加する：

```js
propInheritStyle.addEventListener('change', function () {
  appState.inheritStyle = propInheritStyle.checked;
});
```

- [ ] **Step 5: ブラウザで動作確認**

1. テキストツールでテキストボックスを作成し、フォントサイズを 30px・色を赤に変更する
2. テキストツールで新しいテキストボックスを作成する
3. **期待値**: フォントサイズ 30px・色が赤で作成されること
4. プロパティパネルの「次のテキストに書式を引き継ぐ」のチェックを外す
5. テキストツールで新しいテキストボックスを作成する
6. **期待値**: デフォルト（16px・黒）で作成されること

- [ ] **Step 6: コミット**

```bash
git add index.html js/main.js
git commit -m "feat: 書式引き継ぎのUIとイベントハンドラを追加"
```

---

## Task 3: 注釈複製 — 関数・UI・ショートカット

**Files:**
- Modify: `css/style.css` (末尾に追加)
- Modify: `index.html` (h3 タグをラッパーに変更、複製ボタン追加、ショートカット一覧更新)
- Modify: `js/main.js` (DOM参照、duplicateSelected 関数、ボタンイベント、keydown)

- [ ] **Step 1: css/style.css に複製ボタンのスタイルを追加**

`css/style.css` の末尾（`.toast.show { ... }` の後）に以下を追加する：

```css
/* ============================================================
   Props title row (タイトル + 複製ボタン)
   ============================================================ */
.props-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}
.props-title-row h3 {
  margin-bottom: 0;
}

.btn-duplicate {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 3px 9px;
  cursor: pointer;
  transition: background var(--tr), color var(--tr);
  letter-spacing: 0.01em;
  line-height: 1.5;
}
.btn-duplicate:hover {
  background: var(--border);
  color: var(--fg);
}
```

- [ ] **Step 2: index.html のテキストパネルの h3 を props-title-row に変更**

`index.html` の `#props-text` 内の `<h3>テキスト</h3>` を以下に置き換える：

```html
        <div class="props-title-row">
          <h3>テキスト</h3>
          <button class="btn-duplicate" id="duplicate-btn-text" title="複製 (Ctrl+D)">複製</button>
        </div>
```

- [ ] **Step 3: index.html の画像パネルの h3 を props-title-row に変更**

`index.html` の `#props-image` 内の `<h3>画像</h3>` を以下に置き換える：

```html
        <div class="props-title-row">
          <h3>画像</h3>
          <button class="btn-duplicate" id="duplicate-btn-image" title="複製 (Ctrl+D)">複製</button>
        </div>
```

- [ ] **Step 4: index.html のショートカット一覧に Ctrl+D を追加**

`#props-empty` 内の `<dl class="shortcut-list">` に `Esc` の行の直後に以下を追加する：

```html
          <dt>Ctrl+D</dt><dd>選択を複製</dd>
```

- [ ] **Step 5: main.js に複製ボタンの DOM 参照を追加**

`propInheritStyle` の行の直後に追加する：

```js
var duplicateBtnText  = document.getElementById('duplicate-btn-text');
var duplicateBtnImage = document.getElementById('duplicate-btn-image');
```

- [ ] **Step 6: main.js に duplicateSelected() 関数を追加**

`deleteSelected()` 関数（298〜309行目付近）の直後に以下を追加する：

```js
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
```

- [ ] **Step 7: main.js に複製ボタンのイベントハンドラを追加**

`deleteBtn.addEventListener(...)` の直後に以下を追加する：

```js
duplicateBtnText.addEventListener('click',  function () { if (currentSelection) duplicateSelected(); });
duplicateBtnImage.addEventListener('click', function () { if (currentSelection) duplicateSelected(); });
```

- [ ] **Step 8: main.js の keydown ハンドラに Ctrl+D を追加**

`js/main.js` の `keydown` イベントハンドラ内（237〜255行目付近）、`var map = { ... }` の行の直前に以下を追加する：

```js
  if (e.ctrlKey && e.key === 'd') {
    e.preventDefault();
    if (currentSelection) duplicateSelected();
    return;
  }
```

- [ ] **Step 9: ブラウザで動作確認**

**テキスト複製:**
1. テキストツールでテキストボックスを作成し、文字を入力して Esc
2. 選択ツール (V) でテキストボックスをクリックして選択
3. プロパティパネルの「複製」ボタンをクリック
4. **期待値**: 元と同じ内容・スタイルのテキストボックスが 16px 右下にずれて作成され、選択状態になること
5. Ctrl+D でも同様に動作すること

**画像複製:**
1. 画像ツール (I) で画像を挿入し選択ツールで選択
2. プロパティパネルの「複製」ボタンをクリック
3. **期待値**: 同じ画像が 16px 右下にずれて作成されること

**編集中は Ctrl+D が無効:**
1. テキストボックスをダブルクリックして編集モードに入る
2. Ctrl+D を押す
3. **期待値**: 複製されないこと（ブラウザのブックマーク等のデフォルト動作も抑制されないこと）

- [ ] **Step 10: コミット**

```bash
git add css/style.css index.html js/main.js
git commit -m "feat: 注釈複製機能を追加（ボタン・Ctrl+D）"
```
