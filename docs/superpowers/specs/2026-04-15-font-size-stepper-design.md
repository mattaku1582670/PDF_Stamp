# フォントサイズ入力UX改善 設計書

**日付**: 2026-04-15  
**ステータス**: 承認済み

---

## Context

プロパティパネルのフォントサイズ入力欄は `input[type="number"]` のブラウザネイティブスピナーボタンを使用しているが、ボタンが小さくカーソルを合わせるのが困難。カスタムの +/− ボタンとマウスホイール操作を追加して操作性を改善する。

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `index.html` | −/+ボタンを追加、`stepper-row`クラス付与 |
| `css/style.css` | `.stepper-btn`スタイル追加、ネイティブスピナー非表示 |
| `js/main.js` | クリック・ホイールイベントリスナー追加 |

---

## HTML（`index.html:123-128`）

```html
<label class="prop-label">
  フォントサイズ
  <div class="input-row stepper-row">
    <button class="stepper-btn" id="prop-font-size-dec" tabindex="-1">−</button>
    <input type="number" id="prop-font-size" min="6" max="300" value="16">
    <button class="stepper-btn" id="prop-font-size-inc" tabindex="-1">+</button>
    <span class="unit">px</span>
  </div>
</label>
```

- `tabindex="-1"` でTabキーのフォーカス順から除外

---

## CSS（`css/style.css`）

ブラウザネイティブのスピナーを非表示にし、カスタムボタンスタイルを追加：

```css
/* ネイティブスピナー非表示 */
.input-row input[type="number"]::-webkit-inner-spin-button,
.input-row input[type="number"]::-webkit-outer-spin-button { display: none; }
.input-row input[type="number"] { -moz-appearance: textfield; }

/* +/- ボタン */
.stepper-btn {
  width: 24px;
  height: 28px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--fg);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--tr);
  user-select: none;
}
.stepper-btn:hover { background: var(--border); }
.stepper-btn:active { opacity: 0.7; }
```

---

## JS（`js/main.js`）

既存の `propFontSize` イベントリスナー（`main.js:404`付近）の近くに追加。既存の `'input'` イベント処理ロジックを再利用するため `dispatchEvent` で委譲する。

```js
// −ボタン（クリックで-1、Shiftで-10）
document.getElementById('prop-font-size-dec').addEventListener('click', function (e) {
  var step = e.shiftKey ? 10 : 1;
  propFontSize.value = Math.max(6, +propFontSize.value - step);
  propFontSize.dispatchEvent(new Event('input'));
});

// +ボタン（クリックで+1、Shiftで+10）
document.getElementById('prop-font-size-inc').addEventListener('click', function (e) {
  var step = e.shiftKey ? 10 : 1;
  propFontSize.value = Math.min(300, +propFontSize.value + step);
  propFontSize.dispatchEvent(new Event('input'));
});

// ホイール（上スクロールで+1、下スクロールで-1、Shiftで10刻み）
propFontSize.addEventListener('wheel', function (e) {
  e.preventDefault();
  var step = e.shiftKey ? 10 : 1;
  var delta = e.deltaY < 0 ? step : -step;
  propFontSize.value = Math.max(6, Math.min(300, +propFontSize.value + delta));
  propFontSize.dispatchEvent(new Event('input'));
}, { passive: false });
```

**注意**: ホイールイベントは `{ passive: false }` で登録し `e.preventDefault()` でページスクロールを抑制する。

---

## 動作仕様

| 操作 | 変化量 |
|------|--------|
| −/+ボタンクリック | ±1 |
| Shift + −/+ボタンクリック | ±10 |
| ホイールスクロール | ±1 |
| Shift + ホイールスクロール | ±10 |
| 直接入力（既存） | 任意の値 |

値の範囲は min=6、max=300 を維持。

---

## 検証方法

1. `python -m http.server 8910` でサーバー起動、`http://localhost:8910` を開く
2. PDFを読み込み、テキスト注釈を選択
3. プロパティパネルのフォントサイズ欄で以下を確認：
   - −/+ボタンのクリックで値が±1変化し、テキストサイズが即時反映される
   - Shift+クリックで±10変化する
   - 入力欄上でマウスホイールを回して値が変化する
   - Shift+ホイールで±10変化する
   - 値が6未満・300超にならない
   - ネイティブスピナーが表示されていない
