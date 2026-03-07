"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUsage = checkUsage;
exports.consumeUsage = consumeUsage;
exports.addShareBonus = addShareBonus;
// 洋菜单 - 用户次数管理：检查、消耗、分享奖励
const cloud_1 = require("./cloud");
const BASE_LIMIT = 6;
const MAX_LIMIT = 12;
/** 检查今日使用次数，返回剩余、总额、是否还能通过分享获取 */
async function checkUsage() {
    const res = await (0, cloud_1.callFunction)("getUserInfo", {});
    if (!res.success || !res.user) {
        return { remaining: BASE_LIMIT, total: BASE_LIMIT, canShare: true };
    }
    const dailyUsage = res.user.dailyUsage ?? 0;
    const dailyBonus = res.user.dailyBonus ?? 0;
    const total = BASE_LIMIT + dailyBonus;
    const remaining = Math.max(0, total - dailyUsage);
    const canShare = total < MAX_LIMIT;
    return { remaining, total, canShare };
}
/** 消耗一次使用次数，拍照/识别成功后调用。成功返回 true，超限返回 false */
async function consumeUsage() {
    const res = await (0, cloud_1.callFunction)("getUserInfo", { action: "consume" });
    return res.success === true;
}
/** 分享奖励。amount: 2=朋友 4=朋友圈。返回是否成功和新的剩余次数 */
async function addShareBonus(amount = 2) {
    const res = await (0, cloud_1.callFunction)("getUserInfo", { action: "addBonus", amount });
    if (res.success && typeof res.remaining === "number") {
        return { success: true, newRemaining: res.remaining };
    }
    return { success: false, newRemaining: 0 };
}
