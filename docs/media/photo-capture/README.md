# 逐张拍照页面 / Sequential photo capture

本组为当前共享小程序拍照页的实际浏览器操作录像。页面沿用 C「柚子创作社」设计；照片来自本项目自绘商品，经浏览器合成单张相机/相册返回。它证明页面交互与录制时的断言，不是支付宝/抖音真机相机、相册权限或真实商品识别证明。

These are actual captures of the shared mini-program photo page. Camera/album results use synthetic self-drawn product images. Native device permissions, camera capture, recognition and payments require separate acceptance.

![逐张拍摄、重拍与相册补图 / Sequential capture, retake and album additions](walkthrough.gif)

[MP4](walkthrough.mp4) · [WebM](walkthrough.webm) · [文件 SHA 与操作清单 / File hashes and checks](capture-manifest.json)

| 编号 / No. | 场景 / Scene | 截图 / PNG |
| --- | --- | --- |
| 01 | 空照片组，不能开始识别 / Empty set blocks recognition | [PNG](01-empty.png) |
| 02 | 连续拍三张后可继续 / Three separate camera results | [PNG](02-three-photos.png) |
| 03 | 相册补到五张，添加入口禁用 / Album respects remaining slots | [PNG](03-five-photos.png) |
| 04 | 320px窄屏布局 / Narrow viewport | [PNG](04-narrow.png) |

同时断言单张重拍只改变一个位置、移除到少于三张后再次禁用提交、320px无横向溢出。相机取消和拒权由定向适配器测试覆盖，不能把浏览器合成录像当作宿主授权测试。

Additional assertions check targeted retake, disabled recognition after removal below three and no horizontal overflow at 320px. Picker cancellation/denial use synthetic adapter tests; this recording does not certify native permission behavior.

复录 / Recreate after `delivery:build`:

```powershell
.\scripts\run.ps1 exec tsx scripts/record-photo-capture.ts
```

脚本启动本次本地预览服务，关闭本次所有页面、浏览器和服务；不访问外部业务服务，不调用Docker/WSL。原有全流程媒体保留在上级目录，代表录制时的旧页面；本组为最新拍照操作参照。

The script owns and closes its browser/pages and local preview server. It does not call external business services or virtualization. Earlier walkthrough media remains in the parent directory as historical captures.
