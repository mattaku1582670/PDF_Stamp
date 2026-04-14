# PDF Stamp

PDFにテキストや画像を追加して保存できる、ローカル完結型のスタンプツールです。
サーバー不要・インターネット接続不要で動作します。機密PDFの編集にも安心して使えます。

## 特徴

- **ローカル完結** — ファイルはブラウザ外に送信されません
- **インストール不要** — `index.html` をブラウザで開くだけ
- **オフライン動作** — ライブラリはすべてローカルに同梱済み
- **日本語フォント対応** — PCにインストール済みのフォントをそのまま使用可能

## 機能

| 機能 | 説明 |
|------|------|
| テキスト追加 | クリックした位置にテキストを配置。フォント・サイズ・色・太さを変更可能 |
| 画像追加 | PNG / JPEG を配置。ドラッグで移動、ハンドルでリサイズ、不透明度調整可能 |
| フォント選択 | Font Access API 対応ブラウザではPC内の全フォントから選択可能 |
| 保存 | 編集内容を元PDFに焼き込んで新しいPDFとして保存 |

> **注意**: 追加したテキストは保存時に**画像として埋め込まれます**。
> 保存後のPDFではテキストの選択・コピー・検索・OCRは機能しません。

## 使い方

1. `index.html` を Chrome または Edge で開く
2. 「Open」ボタンまたはキャンバスへのドラッグ&ドロップでPDFを読み込む
3. 左ツールバーからツールを選択してテキスト・画像を追加
4. 「Save As…」で保存

### キーボードショートカット

| キー | 機能 |
|------|------|
| `V` | 選択ツール |
| `T` | テキストツール |
| `I` | 画像ツール |
| `Del` / `Backspace` | 選択中の注釈を削除 |
| `Esc` | 選択解除 |

## 動作環境

- **推奨**: Chrome 103以降、Edge 103以降
- システムフォント一覧の取得には [Font Access API](https://developer.chrome.com/docs/capabilities/web-apis/local-fonts) が必要（Chrome/Edge 103+）
- 非対応ブラウザではプリセットフォント（Meiryo, Yu Gothic など）が使用されます
- `file://` プロトコルで直接開いても動作します

## 技術スタック

| ライブラリ | バージョン | 用途 |
|-----------|-----------|------|
| [PDF.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | PDFの表示・描画 |
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | PDFへの書き出し |

すべてのライブラリは `lib/` ディレクトリにローカル保存されています。

## ファイル構成

```
EditPDF/
├─ index.html          # エントリポイント
├─ css/
│   └─ style.css       # スタイル
├─ js/
│   ├─ main.js         # 状態管理・イベント統合
│   ├─ overlay.js      # オーバーレイ・ツール管理
│   ├─ pdfViewer.js    # PDFレンダリング（PDF.js）
│   ├─ exporter.js     # PDF書き出し（pdf-lib）
│   ├─ shared.js       # 共通ユーティリティ
│   └─ tools/
│       ├─ textTool.js  # テキスト注釈
│       └─ imageTool.js # 画像注釈
└─ lib/
    ├─ pdf.min.js           # PDF.js
    ├─ pdf.worker.min.js    # PDF.js Worker
    └─ pdf-lib.min.js       # pdf-lib
```

## ライセンス

MIT
