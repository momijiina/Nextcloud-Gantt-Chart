# Gantt Chart for Nextcloud

Nextcloud用のガントチャートアプリケーションです。プロジェクト管理をビジュアルなタイムラインで行えます。

**作成者**: momijiina

## 対応バージョン

- Nextcloud 31
- Nextcloud 32

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
│   └── gantt-main.js
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

## 技術スタック

- **バックエンド**: PHP 8.1+ / Nextcloud OCP AppFramework
- **フロントエンド**: Vanilla JavaScript（ビルドツール不要）
- **データベース**: Nextcloud DB抽象化レイヤー（MySQL/PostgreSQL/SQLite）

## ライセンス

AGPL-3.0-or-later
