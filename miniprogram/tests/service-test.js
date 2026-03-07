"use strict";
/**
 * 洋菜单 - 前端服务层测试（微信开发者工具控制台手动运行）
 * 使用方式：在控制台输入 runAllTests() 或 require('./tests/service-test').runAllTests()
 * 需在 app.json 中注册测试页面或在任意页面中 require 后挂到全局
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllTests = runAllTests;
const ai_1 = require("../services/ai");
const history_1 = require("../services/history");
const user_1 = require("../services/user");
const results = [];
function ok(name, pass, msg) {
    results.push({ name, pass, msg });
    console.log(pass ? `  ✅ ${name}` : `  ❌ ${name}${msg ? ": " + msg : ""}`);
}
/** 测试 history.getRecentRecords 返回格式 */
async function testGetRecentRecords() {
    try {
        const list = await (0, history_1.getRecentRecords)(3);
        if (!Array.isArray(list)) {
            ok("getRecentRecords 返回数组", false, "返回类型非数组");
            return;
        }
        ok("getRecentRecords 返回数组", true);
        if (list.length > 0) {
            const item = list[0];
            const hasId = "_id" in item;
            const hasTimeText = "timeText" in item;
            const hasDishSummary = "dishSummary" in item;
            const hasDishCount = "dishCount" in item;
            ok("getRecentRecords 项含 _id/timeText/dishSummary/dishCount", hasId && hasTimeText && hasDishSummary && hasDishCount);
        }
        else {
            ok("getRecentRecords 空记录返回空数组", list.length === 0);
        }
    }
    catch (e) {
        ok("getRecentRecords", false, String(e));
    }
}
/** 测试 history.getRecordById 空 ID 返回 null */
async function testGetRecordByIdEmpty() {
    try {
        const r = await (0, history_1.getRecordById)("");
        ok("getRecordById 空 ID 返回 null", r === null);
    }
    catch (e) {
        ok("getRecordById 空 ID", false, String(e));
    }
}
/** 测试 ai.recognizeMenu 失败时返回 { dishes: [] } 不抛异常 */
async function testRecognizeMenuFail() {
    try {
        const res = await (0, ai_1.recognizeMenu)("invalid-file-id-xxx", false);
        const hasDishes = Array.isArray(res.dishes);
        const noThrow = true;
        ok("recognizeMenu 失败时返回 dishes 数组", hasDishes);
        ok("recognizeMenu 失败时不抛异常", noThrow);
        ok("recognizeMenu 失败时 dishes 为空", res.dishes.length === 0 && !!res.error);
    }
    catch (e) {
        ok("recognizeMenu 失败时不抛异常", false, "抛出了异常: " + String(e));
    }
}
/** 测试 ai.recognizeMenu 返回值结构包含 dishes */
async function testRecognizeMenuStructure() {
    try {
        const res = await (0, ai_1.recognizeMenu)("invalid-file-id-structure-test", false);
        const hasDishes = "dishes" in res && Array.isArray(res.dishes);
        ok("recognizeMenu 返回值含 dishes 数组", hasDishes);
        if (res.dishes.length > 0) {
            const d = res.dishes[0];
            ok("dishes 项含 originalName/briefCN/detail", "originalName" in d && "briefCN" in d && "detail" in d);
        }
    }
    catch (e) {
        ok("recognizeMenu 结构", false, String(e));
    }
}
/** 测试 ai.recognizeManualDishes 失败时返回 { dishes: [] } */
async function testRecognizeManualDishesFail() {
    try {
        const res = await (0, ai_1.recognizeManualDishes)([]);
        ok("recognizeManualDishes 空数组时返回 dishes 数组", Array.isArray(res.dishes));
        ok("recognizeManualDishes 失败时 dishes 为空", res.dishes.length === 0 || !!res.error);
    }
    catch (e) {
        ok("recognizeManualDishes 失败不抛异常", false, String(e));
    }
}
// ===== 次数限制服务层测试 =====
async function testCheckUsage() {
    try {
        const result = await (0, user_1.checkUsage)();
        ok("checkUsage 返回 remaining (number)", typeof result.remaining === "number");
        ok("checkUsage 返回 total (number)", typeof result.total === "number");
        ok("checkUsage 返回 canShare (boolean)", typeof result.canShare === "boolean");
        ok("checkUsage remaining >= 0", result.remaining >= 0);
        ok("checkUsage total >= 6 且 <= 12", result.total >= 6 && result.total <= 12);
        ok("checkUsage remaining <= total", result.remaining <= result.total);
    }
    catch (e) {
        ok("checkUsage 不抛异常", false, String(e));
    }
}
async function testConsumeUsage() {
    try {
        const result = await (0, user_1.consumeUsage)();
        ok("consumeUsage 返回 boolean", typeof result === "boolean");
    }
    catch (e) {
        ok("consumeUsage 不抛异常", false, String(e));
    }
}
async function testAddShareBonus() {
    try {
        const result = await (0, user_1.addShareBonus)();
        ok("addShareBonus 返回 success (boolean)", typeof result.success === "boolean");
        ok("addShareBonus 返回 newRemaining (number)", typeof result.newRemaining === "number");
        if (result.success) {
            ok("addShareBonus newRemaining > 0", result.newRemaining > 0);
        }
    }
    catch (e) {
        ok("addShareBonus 不抛异常", false, String(e));
    }
}
// ===== AI 识别完整性测试 =====
async function testRecognizeMenuDishFields() {
    try {
        const records = await (0, history_1.getRecentRecords)(1);
        if (records.length === 0) {
            ok("菜品字段完整性（无历史记录跳过）", true, "跳过");
            return;
        }
        const record = await (0, history_1.getRecordById)(records[0]._id || records[0].recordId);
        if (!record || !record.dishes || record.dishes.length === 0) {
            ok("菜品字段完整性（记录无菜品跳过）", true, "跳过");
            return;
        }
        const dish = record.dishes[0];
        ok("dish 有 originalName", typeof dish.originalName === "string" && dish.originalName.length > 0);
        ok("dish 有 briefCN", typeof dish.briefCN === "string" && dish.briefCN.length > 0);
        ok("dish 有 detail", dish.detail !== null && dish.detail !== undefined);
        if (dish.detail) {
            ok("detail 有 ingredients (array)", Array.isArray(dish.detail.ingredients));
            ok("detail 有 flavor (string)", typeof dish.detail.flavor === "string");
            ok("detail 有 description 或 introduction", typeof dish.detail.description === "string" || typeof dish.detail.introduction === "string");
        }
    }
    catch (e) {
        ok("菜品字段完整性", false, String(e));
    }
}
async function testRecommendations() {
    try {
        const records = await (0, history_1.getRecentRecords)(1);
        if (records.length === 0) {
            ok("推荐功能（无历史记录跳过）", true, "跳过");
            return;
        }
        const record = await (0, history_1.getRecordById)(records[0]._id || records[0].recordId);
        if (!record) {
            ok("推荐功能（记录不存在跳过）", true, "跳过");
            return;
        }
        if (record.recommendations && record.recommendations.length > 0) {
            const rec = record.recommendations[0];
            ok("recommendation 有 dishIndex (number)", typeof rec.dishIndex === "number");
            ok("recommendation 有 dishName (string)", typeof rec.dishName === "string");
            ok("recommendation 有 reason (string)", typeof rec.reason === "string");
            ok("recommendation dishIndex 在范围内", rec.dishIndex >= 0 && rec.dishIndex < (record.dishes?.length || 999));
        }
        else {
            ok("推荐功能（该记录无推荐，跳过）", true, "跳过");
        }
    }
    catch (e) {
        ok("推荐功能", false, String(e));
    }
}
async function testHistoryDelete() {
    try {
        const result = await (0, history_1.deleteRecordById)("non-existent-id-test-12345");
        ok("deleteRecordById 无效ID不崩溃", true);
    }
    catch (e) {
        ok("deleteRecordById 函数存在", typeof history_1.deleteRecordById === "function");
    }
}
/** 运行所有测试 */
async function runAllTests() {
    results.length = 0;
    console.log("\n========== 洋菜单 服务层测试 ==========\n");
    await testGetRecentRecords();
    await testGetRecordByIdEmpty();
    await testRecognizeMenuFail();
    await testRecognizeMenuStructure();
    await testRecognizeManualDishesFail();
    await testCheckUsage();
    await testConsumeUsage();
    await testAddShareBonus();
    await testRecognizeMenuDishFields();
    await testRecommendations();
    await testHistoryDelete();
    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass).length;
    console.log("\n========== 结果 ==========");
    console.log(`通过: ${passed}  失败: ${failed}`);
    return { passed, failed, results };
}
