// 洋菜单 - 云开发工具函数，封装云函数调用与图片上传
import type { Result } from "../utils/types";

/** 判断是否为「数据超限」类错误（callFunction payload 超限时触发） */
export function isDataExceedMaxSizeError(errMsg: string): boolean {
  if (!errMsg || typeof errMsg !== "string") return false;
  const s = errMsg.toLowerCase().replace(/\s/g, "");
  return /exceed.*max.*size|max.*size|maxze|maxzeabort|dataexceed/i.test(s);
}

/** 调用云函数，统一错误处理 */
export async function callFunction<T>(
  name: string,
  data: object
): Promise<Result<T>> {
  const startTime = Date.now();
  console.log(`[callFunction] Calling ${name}...`);

  try {
    const res = await wx.cloud.callFunction<Result<T>>({ name, data });
    const duration = Date.now() - startTime;
    console.log(`[callFunction] ${name} completed in ${duration}ms`);

    const result = res.result as Result<T>;
    if (result?.success) {
      return result;
    }
    return Object.assign({}, result, {
      success: false,
      error: result?.error ?? "未知错误",
    }) as Result<T>;
  } catch (e: any) {
    const duration = Date.now() - startTime;
    // 微信 SDK 错误信息在 errMsg 字段
    const message = e?.errMsg || (e instanceof Error ? e.message : String(e));

    console.error(`[callFunction] ❌ ${name} FAILED after ${duration}ms`);
    console.error(`[callFunction] 📋 Error message:`, message);
    console.error(`[callFunction] 📋 Error code:`, e?.errCode);
    console.error(`[callFunction] 📋 Full error object:`, JSON.stringify(e, null, 2));

    // 特别标记 data exceed 错误
    if (isDataExceedMaxSizeError(message)) {
      console.error(`[callFunction] 🚨 DATA EXCEED MAX SIZE ERROR DETECTED!`);
      console.error(`[callFunction] 💡 Suggestion: Data payload is too large for wx.cloud.callFunction`);
    }

    return { success: false, error: message };
  }
}

/** 上传图片到云存储，返回 fileID */
export async function uploadImage(filePath: string): Promise<string> {
  try {
    const cloudPath = `menu-images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const res = await wx.cloud.uploadFile({
      cloudPath,
      filePath,
    });
    return res.fileID;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(message);
  }
}
