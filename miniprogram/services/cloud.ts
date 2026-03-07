// 洋菜单 - 云开发工具函数，封装云函数调用与图片上传
import type { Result } from "../utils/types";

/** 调用云函数，统一错误处理 */
export async function callFunction<T>(
  name: string,
  data: object
): Promise<Result<T>> {
  try {
    const res = await wx.cloud.callFunction<Result<T>>({ name, data });
    const result = res.result as Result<T>;
    if (result?.success) {
      return result;
    }
    return Object.assign({}, result, {
      success: false,
      error: result?.error ?? "未知错误",
    }) as Result<T>;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
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
