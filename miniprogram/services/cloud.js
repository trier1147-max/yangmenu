"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callFunction = callFunction;
exports.uploadImage = uploadImage;
/** 调用云函数，统一错误处理 */
async function callFunction(name, data) {
    var _a;
    try {
        const res = await wx.cloud.callFunction({ name, data });
        const result = res.result;
        if (result === null || result === void 0 ? void 0 : result.success) {
            return result;
        }
        return Object.assign(Object.assign({}, result), { success: false, error: (_a = result === null || result === void 0 ? void 0 : result.error) !== null && _a !== void 0 ? _a : "未知错误" });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, error: message };
    }
}
/** 上传图片到云存储，返回 fileID */
async function uploadImage(filePath) {
    try {
        const cloudPath = `menu-images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const res = await wx.cloud.uploadFile({
            cloudPath,
            filePath,
        });
        return res.fileID;
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(message);
    }
}
