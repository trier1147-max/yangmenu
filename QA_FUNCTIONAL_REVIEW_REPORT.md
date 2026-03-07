# 洋菜单 (YangMenu) Pre-Launch Functional Review Report

**Tech Stack**: TypeScript + Vant Weapp + WeChat CloudBase + DeepSeek-VL2  
**Review Date**: 2025-03-07  
**Scope**: Code logic & edge cases, API calls & error handling

---

## 🔴 Critical (must fix before launch)

### Issue 1: First-time user race: consume before user exists
- **File**: `miniprogram/app.ts`, lines 17–28; `cloudfunctions/getUserInfo/index.js`, lines 21–26
- **Description**: `initUser()` is called on `onLaunch` but not awaited. If a first-time user taps "拍照识菜" or "相册选图" before `initUser` completes, `consumeDailyUsage` calls `getUserInfo` with `action: "consume"`. The consume branch does not create a user and returns `{ success: false, error: "用户不存在" }`. The index page then shows "网络异常，请检查网络后重试" (misleading).
- **Risk**: New users may see a wrong error and think the app is broken; they cannot use recognition until they retry after init completes.
- **Suggested fix**: Either (a) create user in the consume branch if not exists, or (b) block the main actions until `initUser` completes (e.g., show a brief loading screen on first launch).

---

## 🟡 Important (should fix before launch)

### Issue 2: No timeout on cloud calls (callFunction, uploadFile, getTempFileURL)
- **File**: `miniprogram/services/cloud.ts`, lines 5–22, 44–55; `cloudfunctions/recognizeMenu/index.js`, line 381
- **Description**: `wx.cloud.callFunction`, `wx.cloud.uploadFile`, and `cloud.getTempFileURL` have no explicit timeout. Platform defaults apply (e.g., 20–60s), but the UI has no feedback if a request hangs.
- **Risk**: User sees loading indefinitely with no error message.
- **Suggested fix**: Wrap cloud calls in `Promise.race` with a timeout (e.g., 60s) and reject with a clear message; ensure loading is cleared on timeout.

### Issue 3: No retry for critical operations (image recognition)
- **File**: `miniprogram/pages/index/index.ts`, `miniprogram/services/ai.ts`
- **Description**: Image recognition (stream and non-stream) has no retry. A transient network or cold-start failure results in immediate failure.
- **Risk**: Poor UX for users on slow networks or during cold starts.
- **Suggested fix**: Add a single retry for `recognizeMenuStream` and `recognizeMenu` on network/timeout errors, with user-visible "正在重试..." feedback.

### Issue 4: uploadImage has no timeout
- **File**: `miniprogram/services/cloud.ts`, lines 44–55
- **Description**: `wx.cloud.uploadFile` can hang on slow networks. No timeout is set.
- **Risk**: User stuck on loading if upload never completes.
- **Suggested fix**: Use `Promise.race` with a 60s timeout; on timeout, reject with "上传超时，请检查网络后重试".

### Issue 5: getRecentRecords ignores partialDishes for stream records
- **File**: `miniprogram/services/history.ts`, lines 53–65
- **Description**: `getRecentRecords` uses only `r.dishes` for `dishCount` and `dishSummary`. For stream records still in `processing`, `dishes` is empty and `partialDishes` has data. These records show "无菜品" and `dishCount: 0`.
- **Risk**: Processing records appear empty or are hidden on the index page (which filters `dishCount > 0`).
- **Suggested fix**: Use `(r.partialDishes?.length ? r.partialDishes : r.dishes) ?? []` for dishCount and dishSummary.

### Issue 6: Error message mismatch when user does not exist
- **File**: `miniprogram/pages/index/index.ts`, lines 118–125, 177–183, 246–252; `cloudfunctions/getUserInfo/index.js`, line 25
- **Description**: When `getUserInfo` returns `{ success: false, error: "用户不存在" }`, the index page shows "网络异常，请检查网络后重试" because it only checks `usageResult.success` and `usageResult.canProceed`.
- **Risk**: Misleading error message; user may retry unnecessarily or give up.
- **Suggested fix**: In `consumeDailyUsage` or index, map "用户不存在" to a specific message like "请稍后再试" or "初始化未完成，请返回首页重试".

### Issue 7: onOrderItemTap scrollIndex can be NaN
- **File**: `miniprogram/pages/menu-list/menu-list.ts`, lines 529–531
- **Description**: `scrollIndex` comes from `Number(e.currentTarget.dataset.scrollIndex)`. If `scrollIndex` is missing or invalid, `Number(undefined)` is `NaN`. `scrollIntoId` becomes `"dish-NaN"`, which does not match any element.
- **Risk**: Tapping an order item to scroll to the dish does nothing.
- **Suggested fix**: Guard with `if (!Number.isFinite(scrollIndex)) return;` or use `scrollIndex >= 0 ? "dish-" + scrollIndex : ""`.

### Issue 8: DeepSeek token/quota limits not explicitly handled in stream path
- **File**: `cloudfunctions/recognizeMenu/index.js`, lines 231–248 (stream) vs 341–348 (non-stream)
- **Description**: Error handling in the non-stream path maps 429, 401, and `insufficient_quota` (code 20031) to friendly messages. The stream path uses a generic status check and does not parse the error body for quota exhaustion.
- **Risk**: When quota is exhausted, stream flow may show a generic error instead of "账户余额不足".
- **Suggested fix**: In the stream response error handler (lines 231–248), parse the error body and map `insufficient_quota` / 20031 to the same friendly message as the non-stream path.

### Issue 9: r.dishes may not be array in multi-file flow
- **File**: `miniprogram/pages/index/index.ts`, line 370
- **Description**: `results.forEach((r) => { r.dishes.forEach((d) => allDishes.push(d)); })` assumes `r.dishes` is always an array. If the cloud returns malformed data (e.g., `dishes: null` or non-array), `.forEach` will throw.
- **Risk**: App crash when processing multi-image recognition with unexpected API response.
- **Suggested fix**: Add `Array.isArray(r.dishes)` guard, or ensure `ai.ts` always returns `dishes` as array (with `Array.isArray(res.data?.dishes) ? res.data.dishes : []`).

---

## 🟢 Minor (nice to have)

### Issue 10: formatTime can produce "NaN-NaN NaN:NaN" for invalid dates
- **File**: `miniprogram/services/history.ts`, lines 72–80
- **Description**: If `r.createdAt` is invalid (e.g., malformed string), `new Date(date)` yields Invalid Date, and `d.getMonth()` etc. are NaN.
- **Risk**: Display of "NaN-NaN NaN:NaN" in history.
- **Suggested fix**: Add `if (!Number.isFinite(d.getTime())) return "未知时间";` at the start of `formatTime`.

### Issue 11: No explicit loading timeout for getRecordById
- **File**: `miniprogram/pages/menu-list/menu-list.ts`, lines 318–330
- **Description**: `getRecordById` is called in `onLoad` and during polling. If the database is slow, the user sees `initialLoading` (spinner) but there is no timeout-specific feedback.
- **Risk**: Minor; platform timeouts apply. Could add a "加载超时" hint.
- **Suggested fix**: Optional: add a 10s timeout for the initial `getRecordById` and show "加载超时，请重试".

### Issue 12: manualInputText maxlength 500 with no server-side validation
- **File**: `miniprogram/pages/index/index.wxml`, line 21; `miniprogram/pages/index/index.ts`, line 266
- **Description**: Textarea has `maxlength="500"`. `parseManualNames` slices to 40 items. No cloud-side length check.
- **Risk**: Low; 500 chars is reasonable. Could add server-side truncation in `recognizeMenu` for `manualDishNames`.
- **Suggested fix**: Optional: in cloud function, truncate `manualDishNames` to 40 items and each name to 50 chars.

### Issue 13: getUserInfo consume has non-atomic read-modify-write
- **File**: `cloudfunctions/getUserInfo/index.js`, lines 22–37
- **Description**: `get()` then `update()` is not atomic. Two concurrent consumes could both read `dailyUsage: 5` and both write `6`, allowing 7 uses.
- **Risk**: Slight over-use of free quota; acceptable for a free tier.
- **Suggested fix**: Optional: use a transaction or atomic increment if available in WeChat Cloud.

### Issue 14: Conditional rendering when allDishes is empty but status is done
- **File**: `miniprogram/pages/menu-list/menu-list.wxml`
- **Description**: When `record.status === "done"` but `dishes` is empty (e.g., AI returned no dishes), the UI shows "已识别 0 道菜" and an empty list. No explicit "未识别到菜品" error state.
- **Risk**: User may be confused whether the result is correct.
- **Suggested fix**: Optional: when `status === "done"` and `allDishes.length === 0`, show a dedicated empty-state message like "未识别到有效菜品，请重拍或手动输入".

### Issue 15: TypeScript / runtime validation
- **File**: Various (`miniprogram/services/ai.ts`, `miniprogram/services/cloud.ts`)
- **Description**: Some cloud function results are used without strict validation. `Result<T>` is used but `data` is not validated before use (e.g., `res.data?.dishes` may be non-array).
- **Risk**: Runtime errors if API response shape changes.
- **Suggested fix**: Add runtime checks (e.g., `Array.isArray(res.data?.dishes)`) before using `res.data`.

### Issue 16: compressImage tempFilePath undefined
- **File**: `miniprogram/pages/index/index.ts`, line 345
- **Description**: `compressed.map((c) => uploadImage(c.tempFilePath))` assumes each compress result has `tempFilePath`. If `wx.compressImage` returns an object without it (e.g., on some platforms/errors), `uploadImage(undefined)` would fail with an opaque error.
- **Risk**: Low; WeChat API typically returns `tempFilePath`. Could add a guard for robustness.
- **Suggested fix**: Optional: filter or guard `c.tempFilePath` before passing to `uploadImage`, e.g. `compressed.filter((c) => c?.tempFilePath).map(...)`.

### Issue 17: Empty filePaths could pass to compressImage
- **File**: `miniprogram/pages/index/index.ts`, lines 334–343
- **Description**: `filePaths = files.map((f) => f.tempFilePath)` may include `undefined` if any `tempFilePath` is missing. `wx.compressImage({ src: undefined })` may throw or behave unpredictably.
- **Risk**: Low; chooseMedia typically returns valid paths. Defensive filtering would improve robustness.
- **Suggested fix**: Optional: `const filePaths = files.map((f) => f.tempFilePath).filter(Boolean);` and handle empty result.

---

## ✅ Resolved (verified in current codebase)

The following issues from prior review have been addressed:

- **Polling timeout**: `menu-list.ts` now has a 90s elapsed-time limit (lines 428–435). Polling stops and shows "识别超时，请返回重试".
- **Stream worker invocation failure**: `recognizeMenu/index.js` (lines 393–406) now updates the record to `status: "error"` with `errorMessage: "识别服务启动失败，请重试"` in the `.catch` block.
- **saveRecord malformed dishes**: `saveRecord/index.js` (lines 18–24) now filters with `dishes.filter((d) => d != null && typeof d === "object")` before mapping.

---

## ✅ Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟡 Important | 9 |
| 🟢 Minor | 8 |

**Total: 18 issues** (3 previously reported issues have been resolved)

---

## Additional Notes

- **Image validation**: Index page correctly validates size (4MB) and format (jpg/jpeg/png) before upload.
- **Loading states**: Custom loading overlay is used consistently; `handleMediaResult` returns before setting loading when `files.length === 0`, so no leak in that path.
- **Cloud function timeouts**: OCR has 15s, DeepSeek has 55s; both are reasonable.
- **Data validation**: `recognizeMenu` and `recognizeManualDishes` return `dishes: []` on failure; client should add `Array.isArray` guard for multi-file flow.
- **Lifecycle**: `menu-list` clears `_pollTimer` and `_processingTimer` in `onUnload`; no obvious orphaned state.
- **onDishTap**: Proper guard for `NaN` and out-of-range index (line 650).
- **history.wxml**: Uses `wx:for` with `index` for divider; `index !== list.length - 1` is valid WeChat miniprogram syntax.
