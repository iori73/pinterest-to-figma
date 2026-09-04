# Lessons

## [2026-08-29] テンプレート構成の選定

arrow-connect の構成（esbuild + build-ui.js でJSをHTMLにインライン化）を採用。
理由: 依存が少なく、React + TSX + manifest 分離が明快で他プラグインより見通しが良い。
screenshot-importer 型（code.js を直接コミット、archive フォルダ持ち）は複雑化しやすいので今回は避けた。

## [2026-08-29] Pinterestボードのスクレイピング方法

Pinterestのボードページには `<script id="__PWS_INITIAL_PROPS__">` にReduxの初期state（JSON）が埋め込まれており、
`initialReduxState.boards` の最初のキーが `board_id`、`initialReduxState.resources.BoardFeedResource` の中に
初期ピン一覧と次ページ用の `bookmark` が入っている。続きは
`https://www.pinterest.com/resource/BoardFeedResource/get/?data=<encoded json>` に
`board_id` / `board_url` / `bookmarks:[bookmark]` を渡せば、ログインなし・Cookieなしでも200が返る
（`X-Pinterest-PWS-Handler` ヘッダを付けると安定した。付けないと403になるケースを確認）。
`bookmark` が `null` になったら最終ページ。実際に `curl` で公開ボードに対して検証済み（このセッションのbash実行ログ参照）。

Figma本体（デスクトップ/ブラウザアプリ）内での `fetch()` がこのエンドポイントに対して同様に動くかは、
このセッションからはFigmaアプリを起動できないため未検証。ユーザー側の実機確認が必須。

## [2026-09-03] 【訂正】Figmaプラグインsandboxの fetch() はCORSを回避しない

上記の「未検証」項目をユーザーの実機で確認してもらったところ、下記の想定は**誤りだった**:
「Figmaのプラグインsandbox（main thread, code.ts）の fetch() はブラウザのCORS制約を受けない」

実際は、ユーザーのコンソールログで
`Access to fetch at 'https://jp.pinterest.com/...' from origin 'null' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present` というエラーが確認された。
つまりFigmaのプラグインsandboxも実体は origin `null` のiframe/webview内で動いており、
通常のブラウザと同様にCORSが強制される。Pinterest側はこれらのページ/APIにCORSヘッダーを付与していないため、
**プラグイン単体（バックエンドなし）でPinterestのボードHTML/JSONを直接fetchすることは不可能**。

これは「有料版が課金制なのは、CORSを回避するためにサーバー経由でPinterestを取得しているから」という
仮説を裏付ける。今後、他のFigmaプラグインで外部サイトを`fetch()`する設計をする際は、
**「多くのプラグインがバックエンドなしで外部APIを叩いている」という前提を鵜呑みにせず、
対象サイトが実際にCORSヘッダーを返すか（あるいはFigma公式ドメインのように内部的に許可されているか）を
必ず個別に確認すること**。確認せずに設計すると、今回のように実装が全て無駄になる。

対処: `worker/pinterest-proxy.js`（Cloudflare Workers、無料枠）を自前で用意し、
サーバー・サーバー間通信（CORS制約なし）でPinterestを取得してCORSヘッダーを付与して返す方式に変更。
実際のWorkerの挙動はこのセッションからNode上でworkerのfetch handlerを直接importして
実サイトに対してシミュレーション検証済み（200応答・CORSヘッダー付与・非pinterest.comホストの403拒否まで確認）。
ただし実際にCloudflareへデプロイした本番Workerでの動作はユーザー側でのデプロイ後、要確認。
