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
→ その後 progress.txt の [2026-09-04〜09-05] エントリで実際にデプロイし解決（wrangler.toml未整備が原因だった）。

## [2026-09-05] コード内で完結しない機能は「無料枠の制約」を先に数値で確認する

ユーザーから「カラー分布を丸ではなく横棒グラフで、割合も表現したい」という要望を受けた際、
実装に着手する前に **Cloudflare Workers無料枠のCPU時間上限（リクエストあたり10ms）** を先に確認したことで、
「フルサイズ画像をデコードして色解析する」という無茶な設計を避け、「60x60の極小サムネイルに絞って試す」という
実現可能な方式にユーザーと合意できた。もし先に実装してから制限に気づいていたら、大きな手戻りになっていた。

**教訓**: 外部サービス（Cloudflare, AWS Lambda等）の無料枠を使う機能を作るときは、
実装前に「無料枠のCPU時間/メモリ/リクエスト数などの数値上限」を確認し、想定するワークロード
（今回なら「画像1枚のJPEGデコード時間」）がその上限に収まるかを見積もってから着手する。
見積もりだけでなく、可能なら実際にローカルでシミュレーション実行して実測値を取る
（今回は Node.js 上で jpeg-js デコーダを直接呼び出し、実際のPinterest画像で6msという実測値を得てから
Worker側の実装に進んだ）。

## [2026-09-05] 自前実装が不安なアルゴリズムは、記憶から書かずに実在のOSSを持ってくる

JPEGデコーダのような「細部を間違えると気づきにくいバグになる」複雑なアルゴリズムを、記憶だけを頼りに
書き起こすことはしなかった。代わりに `curl` で実在のOSS（jpeg-js, MIT/BSD-3 + Apache 2.0）のソースを
そのまま取得し、末尾のエクスポート部分だけをESM形式に置き換えて移植した。
**理由**: JPEGデコード（Huffmanデコード、IDCT、色変換など）を記憶から再現すると、動くように見えて
実は色や画像サイズが微妙に間違っている、といった検出しづらいバグを埋め込むリスクが高い。
実在するテスト済みの実装を使い、変更点を最小限（エクスポート部分のみ）にとどめる方が、
検証（この時は実際にPinterestの既知のdominant_colorと比較して答え合わせした）もしやすい。
**適用範囲**: 画像/音声コーデック、暗号、パーサーなど「仕様の細部を正確に守る必要があるアルゴリズム」全般。

## [2026-09-05] Pinterestのboard.pin_countは「実際に取得できる件数」と一致しない

ボードオブジェクトの `pin_count`（例: 32）と、実際に `BoardFeedResource` を最後までページネーションして
取得できるピン数（同じボードで25件）が食い違うケースを実データで確認した。
おそらく非公開ピンやセクション限定ピンなど、通常のフィードには出てこないが公式カウントには含まれるものがあるため。
**教訓**: 外部APIが返す「件数」系のメタデータは、実際にページネーションして得られる件数と必ずしも一致しない
前提で設計する。UIで表示する際は「~N件」のようにおおよその値であることを明示し、
実際にフェッチできた件数を正としてその後の処理（進捗表示・完了メッセージ）を行う。
