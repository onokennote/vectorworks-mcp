# Vectorworks RAG + MCP (Docker Compose 版)

- Vectorworks の Python / VectorScript ドキュメントをローカルに取り込み、FAISS で横断検索します。
- FastAPI で `/search` `/answer` `/get` を提供し、簡易 Web UI から検索・出典確認できます。
- WebSocket(JSON-RPC 2.0) の MCP サーバーを同時起動し、`vw.search` / `vw.answer` / `vw.get` ツールを提供します。
- docker compose で `app`（API/MCP）と `db`（Postgres 16）を同時起動します（MVPではDB未使用、将来拡張用）。

---

## 必要要件

- Docker / Docker Compose（v2）

## クイックスタート（Compose 前提）

1) ビルド
- `docker compose build`

2) 文書取得（最小セット）
- `docker compose run --rm app bash scripts/fetch_docs_minimal.sh`

3) ベクター生成（埋め込み + FAISS）
- `docker compose run --rm app python -m app.indexer`

4) 起動（UI + MCP + Postgres）
- `docker compose up`

5) アクセス
- UI: `http://localhost:8000`
- MCP: `ws://localhost:8765`

補足
- 2) と 3) は次のワンライナーでも可:
  - `docker compose run --rm app bash -lc 'scripts/fetch_docs_minimal.sh && python -m app.indexer'`


## ドキュメントの取得（最小セット）

以下のコマンドで、必要最小限のドキュメント（md/html のみ）を `data/` に取得します。

- 依存: `git`, `curl`
- 実行（コンテナ内）:
  - `docker compose run --rm app bash scripts/fetch_docs_minimal.sh`
  - ネットワーク事情で 403 が発生する場合、スクリプトは該当ページをスキップして続行します。
  - 必要なら UA を上書き可能: `docker compose run --rm -e UA="Mozilla/5.0 ..." app bash scripts/fetch_docs_minimal.sh`

取得対象（要点のみ）
- GitHub: Vectorworks/developer-scripting（入門/導線のMarkdown）
- App Help: Scripting の基本導線（2022/2023/2024 の要点ページ）
- 日本語サイト: VectorScript 関数索引ページ + 例示ページ
- Developer Wiki: VS Function Reference カテゴリインデックス（HTML）

注意
- インデクサは `.md` `.markdown` `.html` `.htm` `.txt` のみ対応です。PDF 等は対象外です。


## ベクター生成（埋め込み + FAISS インデックス）

- 実行（コンテナ内）:
  - `docker compose run --rm app python -m app.indexer`

実行後、`index/` に `vw.faiss` と `meta.jsonl` が作成されます。
（先に `bash scripts/fetch_docs_minimal.sh` を実行して `data/` に文書がある状態にしてください）


## 起動（UI + MCP + Postgres）

- `docker compose up --build`
- UI: `http://localhost:8000`
- MCP: `ws://localhost:8765`
- Postgres はコンテナ内部ネットワークで起動（ホストへ未公開）


## API 例

- 検索: `GET /search?q=PushAttrs&k=6`
  - 例: `curl -s "http://localhost:8000/search?q=VectorScript&k=6" | jq .`
- 回答（ドラフト）: `GET /answer?q=...&k=6`
  - 例: `curl -s "http://localhost:8000/answer?q=record+format" | jq .`
- チャンク取得: `GET /get?doc_id=...&chunk_id=...`

UI は `GET /` にあり、検索フォームから同等の結果を確認できます。


## MCP（Model Context Protocol）

- VS Code から接続: 次のコマンドで MCP を追加
  - `code --add-mcp '{"name":"vw_docs_local","url":"ws://localhost:8765"}'`
- サポートするツール
  - `vw.search({ query, k? })`
  - `vw.answer({ query, k? })`
  - `vw.get({ doc_id, chunk_id })`

実装は JSON-RPC 2.0 ベースの WebSocket サーバーです（`app/mcp_server.py`）。

## Postgres（自動起動 / 将来拡張用）

- サービス: `db`（`postgres:16`）
- ポート: `5432`（内部ネットワークのみ。デフォルトではホストへ公開しません）
- 既定の環境変数（docker-compose.yml）
  - `POSTGRES_DB=vw`
  - `POSTGRES_USER=vw`
  - `POSTGRES_PASSWORD=vw`
- アプリ側の環境変数（将来利用を想定）
  - `PGHOST=db`, `PGPORT=5432`, `PGDATABASE=vw`, `PGUSER=vw`, `PGPASSWORD=vw`
- 現段階（MVP）では FAISS ローカルインデックスを使用し、DB は未使用です。
  ホストから DB に接続したい場合は下記いずれかで公開してください（例: 55432）。
  - 一時的に: `docker compose run --rm -p 55432:5432 db`（別端末で）
  - もしくは override ファイルで `db.ports: ["55432:5432"]` を追加


## ディレクトリ構成

- `app/` アプリ本体
  - `api.py` FastAPI アプリ
  - `mcp_server.py` MCP(WebSocket) サーバー
  - `indexer.py` 取込・ベクター化（埋め込み + FAISS 作成）
  - `search.py` 検索/回答のコアロジック
  - `chunking.py` チャンク分割（約 700 トークン相当の文字長を目安）
- `templates/` Web UI テンプレート
- `data/` 原文の md/html（相対パスが `doc_id`）
- `index/` FAISS とメタデータ（`vw.faiss`, `meta.jsonl`）


## 環境変数（任意）

- `DATA_DIR` データ配置ディレクトリ（既定: `data`）
- `INDEX_DIR` インデックス出力ディレクトリ（既定: `index`）
- `EMBED_MODEL` 埋め込みモデル（既定: `sentence-transformers/all-MiniLM-L6-v2`）
- `CHUNK_CHARS` チャンク文字長の目安（既定: `2800` ≒ 700 トークン）
- `CHUNK_OVERLAP` チャンクの文字オーバーラップ（既定: `480`）
- `API_HOST` / `API_PORT` FastAPI バインド（既定: `0.0.0.0:8000`）
- `MCP_HOST` / `MCP_PORT` MCP バインド（既定: `0.0.0.0:8765`）
  
Postgres（将来用）
- `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD`


## 運用メモ

- ドキュメントを更新したら、再度ベクター生成: `python -m app.indexer`
- 初回は埋め込みモデルのダウンロードで時間がかかる場合があります。
- CPU で実行する前提のため、FAISS は `IndexFlatIP` + 正規化ベクター（cosine 相当）を使用しています。


## ライセンス / 注意

- このリポジトリはドキュメントを含みません。各自の利用規約・著作権に従って `data/` に配置してください。
- `answer` は抜粋ベースの簡易ドラフトです。最終判断は原文を確認してください。
