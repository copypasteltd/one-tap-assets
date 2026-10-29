# Native quick start

Private [final audio review and publication](../实施/原生声音最终双复核与事务交付-v1.0.md) is connected for both generated routes. Tests use actual native database/media and explicitly fabricated semantic/provider/rights/usage/isolation responses. LISTENING and ASR configuration default to disabled; their endpoints, keys and exact host allowlists stay empty in the example. Model/rate/capability registration and the original sold contract are also required. Environment values never enable sales. Saved-original receipt maintenance does not repurchase UNKNOWN calls. Public audio orders and real-service/device admission remain closed.

[中文](QUICKSTART.md) · [Project README](../../README.en.md) · [Status](STATUS.md)

The internal transcription service has separate `ASR_SERVICE_ENABLED=false`, `ASR_BASE_URL`, `ASR_API_KEY` and `ASR_ALLOWED_HOSTS` configuration. It defaults to disabled. Environment variables alone cannot admit audible orders: the original POST lease, model/rate contract, registered private video and restricted HTTPS storage are still required. [Configuration and seventeen native fixtures](../实施/异步音频转写与原任务回执-v1.0.md). The [audio contract and original-order accounting guide](../实施/原生声音合同与原订单费用-v1.0.md) documents character/voice/music rights, captions, one complete-track ASR, migration023 and twenty-three additional native fixtures. Scoped private audio tools and technical file QC are implemented; real authorizations/providers and production listening/final review/delivery quality remain unadmitted.

Run all commands from the checkout root in Windows PowerShell. The current development workspace is `E:\dev\sandbox\支付宝黑客松\一品成片`. Do not launch Docker, WSL, VMs or indirect container scripts. Tools, caches, builds, test media and the local database belong in ignored `runtime/`.

## 1. Dependencies and browser replay

Install Git and PowerShell with network access. Documentation/contract validation also needs local Python 3. The current verified runtime is Node 24.22.1 and pnpm 10.13.1. Bootstrap downloads Node 24 LTS from its official source and checks the official checksum. Optional native PostgreSQL is EDB 17.6-1; its download hash is recorded without claiming an independently published vendor checksum.

```powershell
.\scripts\bootstrap-native.ps1
.\scripts\run.ps1 install --frozen-lockfile
.\scripts\run.ps1 dev:preview
```

Open `http://127.0.0.1:4173/`. Shared screens use only `src/preview/fixtures.ts`: no business API, provider or payment calls, and no `.env.local` required. The scene selector can jump to later states; this is not evidence of real production. Close the tabs and stop the server with `Ctrl+C` afterward.

## 2. Native database and API

Supply native Windows FFmpeg and ffprobe binaries, preferably under `runtime/tools/`, and verify their source. The project does not obtain media tools through WSL or another project’s containers.

```powershell
.\scripts\bootstrap-native.ps1 -Postgres
.\scripts\run.ps1 exec tsx scripts/dev-setup.ts
```

First setup generates `.env.local`, local TLS certificates and random credentials, starts native PostgreSQL on `127.0.0.1:55432`, creates a UTF-8 application database, migrates and seeds it. Do not create an empty `.env.local` from the inventory before initial setup: credentials are generated only when that file is absent. If configuration already exists, ensure it matches your database. Never print or commit its credentials.

Set actual project-local executable paths in the generated file:

```dotenv
FFMPEG_PATH=E:/your-checkout/runtime/tools/ffmpeg/bin/ffmpeg.exe
FFPROBE_PATH=E:/your-checkout/runtime/tools/ffmpeg/bin/ffprobe.exe
PAYMENTS_ENABLED=false
PROVIDER_GENERATION_ENABLED=false
COMMUNITY_PUBLISHING_ENABLED=false
CODEX_SERVICE_ENABLED=false
```

```powershell
.\scripts\run.ps1 dev:api
```

The default API is `https://localhost:3100`; the local certificate is not a production certificate. Unadmitted capabilities remain blocked. Running the API does not enable paid production. Business and management contracts are in `assets/development/v1.1/contracts/`; generated clients are under `src/shared/contracts/`.

## 3. Workers and maintenance

Use a separate root-directory terminal for each process:

```powershell
.\scripts\run.ps1 dev:worker
.\scripts\run.ps1 dev:reaper
.\scripts\run.ps1 dev:media-maintenance
```

With paid flags off, the development worker supports operational recovery/maintenance but does not register unadmitted production capabilities. Production generation refuses an incomplete required-stage registry. `start:api`, `start:worker`, `start:reaper` and `start:media-maintenance` use entries emitted by `build:server`.

The independent signed deletion-journal CLI is:

```powershell
.\scripts\run.ps1 privacy:journal initialize
.\scripts\run.ps1 privacy:journal status
```

Initialize only after configuring an independent directory, source and signing key. Do not roll the journal back with a database backup. Restore uses `block/replay/finish --expected-head-sha256=<externally-pinned-digest>`; first read the [restore protocol](../实施/数据库外删除日志与原生备份恢复-v1.0.md). Keep payment disabled until financial recovery is admitted. Do not reconstruct an empty journal, remove locks or fabricate checkpoints to bypass a gate.

## 4. Mini-program builds and native testing

```powershell
$env:TARO_APP_API_BASE = 'https://your-admitted-api.example'
.\scripts\run.ps1 build:alipay
.\scripts\run.ps1 build:douyin
```

Import `runtime/build/mini-alipay/` and `runtime/build/mini-douyin/` into official platform developer tools. Real testing needs approved apps/merchants, trusted HTTPS and domain allowlists, callbacks and native login/upload/payment/album permissions. Douyin payment additionally needs an admitted `TARO_APP_DOUYIN_TRADE_CONTRACT`. Never inject private merchant/provider keys into `TARO_APP_*`.

Local self-signed TLS and loopback addresses are not automatically a phone-accessible production backend. Plus and management web UI are not implemented, so there is no `dev:web`. `dev:preview` is the explicitly labeled shared-page replay.

## 5. Verification and capture

```powershell
.\scripts\run.ps1 typecheck
.\scripts\run.ps1 test
.\scripts\run.ps1 test:integration
.\scripts\run.ps1 build:server
.\scripts\run.ps1 build:preview
.\scripts\run.ps1 verify:implementation
.\scripts\run.ps1 verify:docs
.\scripts\run.ps1 verify:publication
```

`verify:implementation` runs six sequential checks: types, units, native integration, server and both mini-program builds, then records source/contract/resource hashes. Individual commands are for targeted checks; do not repeat the full suite without a reason. Integration needs the native database and media binaries. Role/provider/host responses are explicit fixtures. Local logs stay in ignored `runtime/test-results/`; public summaries are in `docs/verification/`.

For recording, start `dev:preview` and follow the [demo guide](DEMO.md) to run `docs:media`. Refresh source evidence after code changes, applicable media after UI changes, and links after documentation changes. Commit/push normally and verify the remote under the [contribution rules](../../CONTRIBUTING.md).
