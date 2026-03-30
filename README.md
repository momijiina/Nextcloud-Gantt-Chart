# Gantt Chart for Nextcloud
Nextcloud用のガントチャートアプリケーションです。プロジェクト管理をビジュアルなタイムラインで行えます。<br/>
テスト開発の為、今後の開発は不明<br/>
**作成者**: momijiina

<img width="1913" height="983" alt="image" src="https://github.com/user-attachments/assets/278f3858-5fc4-4e1b-bc6d-4873ea3f54af" />

<img width="1909" height="978" alt="image" src="https://github.com/user-attachments/assets/8ebefc1f-a744-45ae-b7c2-6dd2ae393cc7" />


## 対応バージョン

- Nextcloud 31 〜 33

## 対応言語

- 日本語（デフォルト）
- English
- 한국어（韓国語）
- Русский（ロシア語）
- Français（フランス語）
- 中文简体（中国語）

## 機能

- **プロジェクト管理**: 複数プロジェクトの作成・編集・削除
- **タスク管理**: タスクの追加、開始日/終了日、進捗率、カテゴリ、担当者の設定
- **ガントチャート表示**: タイムライン上にタスクバーを表示
- **ドラッグ&ドロップ**: タスクバーのドラッグによる日程変更
- **リサイズ**: タスクバーの端をドラッグして期間変更
- **カテゴリ管理**: 自由入力のカテゴリ、ハッシュベース自動カラー割り当て
- **フィルタ**: カテゴリ別フィルタリング、検索バー
- **モーダルUI**: プロジェクト・タスクの作成・編集をモーダルダイアログで操作
- **担当者アバター**: タスクバーに担当者のイニシャルアバターを表示
- **今日マーカー**: 今日の日付を赤線で表示
- **今日ボタン**: ワンクリックで今日の日付位置までスクロール
- **タスク行クリック**: タスク行をクリックするとタイムラインがそのタスクの位置まで自動スクロール
- **Deck連携**: Deckデータとの連携（設定で切り替え可能）
  - Deckボードのカードをガントチャートに表示
  - ダブルクリックでタスク編集（タイトル・説明・締切日）
  - 右端ドラッグで締切日（duedate）の変更
  - 「Deckで開く」リンクで該当カードに直接遷移
  - ※開始日はカード作成日（Deck APIの仕様により変更不可）
- **フルスクリーンモード**: ガントチャートを全画面表示
- **多言語対応**: 6言語サポート（Nextcloudのユーザー言語設定に自動追従）
## インストール

### 手動インストール

1. `gantt.zip` を Nextcloud の `apps/` ディレクトリに展開:
   ```bash
   cd /path/to/nextcloud/apps/
   unzip gantt.zip
   ```

2. アプリを有効化:
   ```bash
   sudo -u www-data php occ app:enable gantt
   ```

ビルドステップは不要です。フロントエンドは Vanilla JavaScript で実装されています。

## ディレクトリ構成

```
gantt/
├── appinfo/          # アプリメタデータ、ルーティング
│   ├── info.xml
│   └── routes.php
├── css/              # スタイルシート
│   └── gantt-main.css
├── img/              # アイコン
│   └── app.svg
├── js/               # JavaScript (ビルド不要)
│   ├── gantt-main.js
│   └── l10n/         # クライアント側翻訳ファイル
│       ├── ja.js
│       ├── ko.js
│       ├── ru.js
│       ├── fr.js
│       └── zh_CN.js
├── l10n/             # 翻訳 JSON
│   ├── ja.json
│   ├── ko.json
│   ├── ru.json
│   ├── fr.json
│   └── zh_CN.json
├── lib/              # PHPバックエンド
│   ├── AppInfo/      # アプリケーション設定
│   ├── Controller/   # APIコントローラー
│   ├── Db/           # エンティティ、マッパー
│   ├── Migration/    # DBマイグレーション
│   └── Service/      # ビジネスロジック
└── templates/        # PHPテンプレート
    └── main.php
```

## API

### プロジェクト
- `GET /apps/gantt/api/projects` - プロジェクト一覧
- `POST /apps/gantt/api/projects` - プロジェクト作成
- `PUT /apps/gantt/api/projects/{id}` - プロジェクト更新
- `DELETE /apps/gantt/api/projects/{id}` - プロジェクト削除

### タスク
- `GET /apps/gantt/api/projects/{id}/tasks` - タスク一覧
- `POST /apps/gantt/api/projects/{id}/tasks` - タスク作成
- `PUT /apps/gantt/api/projects/{id}/tasks/{taskId}` - タスク更新
- `DELETE /apps/gantt/api/projects/{id}/tasks/{taskId}` - タスク削除

### Deckデータとの連携
これは完全にテストです
<img width="1741" height="833" alt="image" src="https://github.com/user-attachments/assets/7b58ed42-ba62-419e-bf77-95fd90e12988" />


## 技術スタック

- **バックエンド**: PHP 8.1+ / Nextcloud OCP AppFramework
- **フロントエンド**: Vanilla JavaScript（ビルドツール不要）
- **データベース**: Nextcloud DB抽象化レイヤー（MySQL/PostgreSQL/SQLite）
