# 洋菜单 (YangMenu) 小程序 — 功能代码审查报告

**审查范围**: Code Logic & Edge Cases | API Calls & Error Handling  
**技术栈**: TypeScript + Vant Weapp + WeChat CloudBase + DeepSeek-VL2  
**审查日期**: 2025-03-07

---

## 🔴 Critical (must fix before launch)

### Issue 1: DeepSeek 流式接口未检查 HTTP 状态码

- **File**: `cloudfunctions/recognizeMenu/index.js`, lines 231–279
- **Description**: `callDeepSeekStream` 在收到响应后直接按 SSE 解析，未检查 `res.statusCode`。当接口返回 429（限流）、401（鉴权失败）、500 等错误时，响应体可能是 JSON 错误信息，但代码仍会当作流式数据解析，最终 `resolve(acc.trim())` 返回不完整或错误内容，用户看到“识别失败”或空结果，且无法得到明确错误提示。
- **Risk**: 用户无法区分“服务限流/鉴权失败”与“识别失败”，无法采取正确操作；错误信息可能泄露到 debugInfo。
- **Suggested fix**: 在 `res.on("data")` 之前或首个 chunk 中检查 `res.statusCode >= 400`，读取 body 并 `reject` 带友好提示的错误（参考 `callDeepSeekWithText` 中 328–336 行的处理方式）。

### Issue 2: getUserInfo 新建用户后可能访问 undefined

- **File**: `cloudfunctions/getUserInfo/index.js`, lines 44–55
- **Description**: 新建用户后通过 `users.where({ _openid: openid }).get()` 再次查询，使用 `user = newData[0]`。在极端情况（如复制延迟、并发创建）下 `newData[0]` 可能为 `undefined`，后续 `user._openid` 等访问会抛错，导致云函数崩溃。
- **Risk**: 新用户首次打开小程序时可能直接报错，无法完成初始化。
- **Suggested fix**: 在 `user = newData[0]` 后增加 `if (!user)` 判断，使用 `add` 返回的 `_id` 或重试一次，或返回一个安全的默认 user 结构。

### Issue 3: onDishTap 中 dataset.index 为 NaN 时可能崩溃

- **File**: `miniprogram/pages/menu-list/menu-list.ts`, lines 457–461
- **Description**: `const index = Number(e.currentTarget.dataset.index)` 在 `dataset.index` 为 `undefined` 时得到 `NaN`。当前判断 `index < 0 || index >= dishes.length` 对 `NaN` 均为 false（`NaN` 与任何数比较都为 false），因此不会提前 return。随后 `dishes[index]` 为 `undefined`，访问 `dish.key` 会抛错。
- **Risk**: 在异常事件或模板绑定错误时，点击菜品卡片可能导致页面崩溃。
- **Suggested fix**: 增加 `Number.isNaN(index)` 判断，例如 `if (Number.isNaN(index) || index < 0 || index >= dishes.length) return;`。

---

## 🟡 Important (should fix before launch)

### Issue 4: 云函数调用无客户端超时

- **File**: `miniprogram/services/cloud.ts`, lines 5–22
- **Description**: `wx.cloud.callFunction` 未设置超时。云函数冷启动或网络异常时，客户端可能长时间等待（平台默认约 60s），用户只看到 loading，无法得知是超时还是其他问题。
- **Risk**: 用户体验差，可能误以为卡死并反复操作，引发重复请求或状态混乱。
- **Suggested fix**: 使用 `Promise.race` 包装 `callFunction`，在 60–90 秒后 reject 并提示“请求超时，请检查网络后重试”。

### Issue 5: 拍照/相册/手动输入无防重复点击

- **File**: `miniprogram/pages/index/index.ts`, lines 65–96, 115–154
- **Description**: `onTakePhoto`、`onChooseAlbum`、`onManualInputConfirm` 等入口无防抖或 loading 期间禁用。用户快速多次点击时，可能同时发起多路识别流程，导致重复请求、多次导航、或对已销毁页面调用 `setData`。
- **Risk**: 重复识别、重复保存记录、偶发白屏或控制台报错。
- **Suggested fix**: 在 `loading === true` 时直接 return，或在入口处加 `if (this.data.loading) return;`。

### Issue 6: 多图识别时 r.dishes 可能为 undefined 的防御不足

- **File**: `miniprogram/pages/index/index.ts`, lines 244–248
- **Description**: `results.forEach((r) => { r.dishes.forEach((d) => allDishes.push(d)); })` 假设 `r.dishes` 始终存在。当前 `recognizeMenu` 在失败时返回 `{ dishes: [], error }`，理论上 `dishes` 始终为数组，但若未来修改返回结构或出现异常，此处可能抛错。
- **Risk**: 多图识别时若某次返回结构异常，整段逻辑崩溃。
- **Suggested fix**: 使用 `(r.dishes ?? []).forEach(...)` 做防御性处理。

### Issue 7: 图片上传前无大小与格式校验

- **File**: `miniprogram/pages/index/index.ts`, lines 210–222; `miniprogram/services/cloud.ts`, lines 25–37
- **Description**: 未在调用 `wx.compressImage` 或 `uploadImage` 前校验文件大小和格式。超大图片可能导致压缩失败或内存问题；非图片格式可能导致上传失败，用户只看到笼统错误。
- **Risk**: 大图或错误格式导致崩溃或长时间无响应，错误提示不明确。
- **Suggested fix**: 在 `handleMediaResult` 中，对 `tempFilePath` 使用 `wx.getFileInfo` 检查大小（如 >10MB 提示“图片过大”），并限制为 jpg/png。

### Issue 8: 流式识别 worker 失败时记录可能长期处于 processing

- **File**: `cloudfunctions/recognizeMenu/index.js`, lines 364–371, 403–348
- **Description**: 流式入口创建记录后通过 `cloud.callFunction` 异步调用 worker，失败时仅 `console.error`。若 worker 因冷启动超时等原因未执行，或执行中途崩溃且未进入 catch，记录会一直停留在 `status: "processing"`。
- **Risk**: 用户轮询到“未找到记录”或长时间看到“识别中”，且数据库存在僵尸记录。
- **Suggested fix**: 为 worker 的 `callFunction` 增加 `.catch` 中更新记录为 `status: "error"` 的逻辑；或增加定时任务清理长时间处于 processing 的记录。

### Issue 9: 每日使用限制未在识别前校验

- **File**: `cloudfunctions/getUserInfo/index.js` (consume 逻辑); `miniprogram/services/ai.ts`; `miniprogram/pages/index/index.ts`
- **Description**: `getUserInfo` 实现了 `action: "consume"` 的每日 6 次限制，但客户端在调用 `recognizeMenu`、`recognizeManualDishes` 等前从未调用该 consume 接口，限制实际未生效。
- **Risk**: 若产品设计需要限流，当前实现无法限制滥用；若不需要，则存在死代码和逻辑不一致。
- **Suggested fix**: 若需限流，在 `handleMediaResult` 和 `onManualInputConfirm` 中，在发起识别前先调用 `getUserInfo` 的 consume，失败时提示“今日次数已用完”；若不需要，可移除或注释 consume 相关逻辑并更新文档。

---

## 🟢 Minor (nice to have)

### Issue 10: formatTime 对无效日期返回异常字符串

- **File**: `miniprogram/services/history.ts`, lines 73–81
- **Description**: 当 `date` 为无效字符串或非法 Date 时，`new Date(date)` 为 Invalid Date，`d.getTime()` 为 NaN，最终返回类似 `"NaN-NaN NaN:NaN"` 的字符串。
- **Risk**: 历史记录时间显示异常，影响观感。
- **Suggested fix**: 在函数开头增加 `if (!d || !Number.isFinite(d.getTime())) return "未知时间";`。

### Issue 11: 最近识别列表可能展示“空卡片”

- **File**: `miniprogram/services/history.ts`, lines 53–65; `miniprogram/pages/index/index.wxml`, lines 115–156
- **Description**: `getRecentRecords` 会返回 `status: "processing"` 的记录，此时 `dishes` 为空，`dishCount` 为 0。首页用 `wx:if="{{item.dishCount > 0}}"` 过滤，若最近几条均为 processing，会出现“最近识别”卡片存在但无任何可见行的空卡片。
- **Risk**: 界面略显奇怪，用户可能误以为无数据。
- **Suggested fix**: 在 `getRecentRecords` 中过滤掉 `status === "processing"` 且 `dishes.length === 0` 的记录，或在首页对 `dishCount === 0` 的记录显示“识别中”状态。

### Issue 12: applyRecord 对 list 中 null/undefined 元素无防护

- **File**: `miniprogram/pages/menu-list/menu-list.ts`, lines 344–358
- **Description**: `list.map((d, index) => {...})` 假设 `list` 中元素均为有效对象。若数据库存在历史脏数据，`d` 可能为 `null` 或 `undefined`，访问 `d.detail` 会抛错。
- **Risk**: 加载含异常数据的记录时页面崩溃。
- **Suggested fix**: 使用 `list.filter(Boolean).map(...)` 或 `(d ?? {}).detail` 等做防御。

### Issue 13: 无重试机制

- **File**: `miniprogram/services/ai.ts`; `cloudfunctions/recognizeMenu/index.js`
- **Description**: 识别、OCR、DeepSeek 等关键接口均无重试逻辑。网络抖动或短暂限流会导致直接失败。
- **Risk**: 偶发失败率偏高，用户需手动重试。
- **Suggested fix**: 对非用户取消类错误，对 `recognizeMenu`、`callFunction` 等增加 1–2 次指数退避重试。

### Issue 14: 未使用 wx.showLoading / wx.hideLoading

- **File**: 全局
- **Description**: 项目使用自定义 loading 遮罩，未使用 `wx.showLoading`。自定义方案可接受，但需确保所有异步路径都会正确关闭 loading（当前 index 页面的 loading 控制基本正确）。
- **Risk**: 若未来新增异步流程未配对关闭 loading，会出现 loading 常驻。
- **Suggested fix**: 在新增异步流程时，统一在 `try/finally` 或等效逻辑中关闭 loading，并考虑封装统一的 loading 管理工具。

---

## ✅ Summary

- **Critical**: 3 issues
- **Important**: 6 issues
- **Minor**: 5 issues

**建议**: 上线前至少修复全部 Critical 和 Important 项；Minor 项可视排期逐步优化。
