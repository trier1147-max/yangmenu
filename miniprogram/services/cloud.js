"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callFunction = callFunction;
exports.consumeDailyUsage = consumeDailyUsage;
exports.uploadImage = uploadImage;
/** 调用云函数，统一错误处理 */
function callFunction(name, data) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const res = yield wx.cloud.callFunction({ name, data });
            const result = res.result;
            if (result === null || result === void 0 ? void 0 : result.success) {
                return result;
            }
            return Object.assign({}, result, {
                success: false,
                error: (_a = result === null || result === void 0 ? void 0 : result.error) !== null && _a !== void 0 ? _a : "未知错误",
            });
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            return { success: false, error: message };
        }
    });
}
function consumeDailyUsage() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield callFunction("getUserInfo", {
            action: "consume",
        });
        if (res.success === true) {
            return { success: true, canProceed: true };
        }
        if (res.error === "今日次数已用完") {
            return { success: true, canProceed: false, remaining: 0 };
        }
        return { success: false, error: (_a = res.error) !== null && _a !== void 0 ? _a : "未知错误" };
    });
}
/** 上传图片到云存储，返回 fileID */
function uploadImage(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const cloudPath = `menu-images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const res = yield wx.cloud.uploadFile({
                cloudPath,
                filePath,
            });
            return res.fileID;
        }
        catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            throw new Error(message);
        }
    });
}
