"use strict";
/**
 * 洋菜单 - 前端服务层测试（微信开发者工具控制台手动运行）
 * 使用方式：在控制台输入 runAllTests() 或 require('./tests/service-test').runAllTests()
 * 需在 app.json 中注册测试页面或在任意页面中 require 后挂到全局
 */
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
exports.runAllTests = runAllTests;
const ai_1 = require("../services/ai");
const history_1 = require("../services/history");
const results = [];
function ok(name, pass, msg) {
    results.push({ name, pass, msg });
    console.log(pass ? `  ✅ ${name}` : `  ❌ ${name}${msg ? ": " + msg : ""}`);
}
/** 测试 history.getRecentRecords 返回格式 */
function testGetRecentRecords() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const list = yield (0, history_1.getRecentRecords)(3);
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
    });
}
/** 测试 history.getRecordById 空 ID 返回 null */
function testGetRecordByIdEmpty() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const r = yield (0, history_1.getRecordById)("");
            ok("getRecordById 空 ID 返回 null", r === null);
        }
        catch (e) {
            ok("getRecordById 空 ID", false, String(e));
        }
    });
}
/** 测试 ai.recognizeMenu 失败时返回 { dishes: [] } 不抛异常 */
function testRecognizeMenuFail() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield (0, ai_1.recognizeMenu)("invalid-file-id-xxx", false);
            const hasDishes = Array.isArray(res.dishes);
            const noThrow = true;
            ok("recognizeMenu 失败时返回 dishes 数组", hasDishes);
            ok("recognizeMenu 失败时不抛异常", noThrow);
            ok("recognizeMenu 失败时 dishes 为空", res.dishes.length === 0 && !!res.error);
        }
        catch (e) {
            ok("recognizeMenu 失败时不抛异常", false, "抛出了异常: " + String(e));
        }
    });
}
/** 测试 ai.recognizeMenu 返回值结构包含 dishes */
function testRecognizeMenuStructure() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield (0, ai_1.recognizeMenu)("invalid-file-id-structure-test", false);
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
    });
}
/** 测试 ai.recognizeManualDishes 失败时返回 { dishes: [] } */
function testRecognizeManualDishesFail() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield (0, ai_1.recognizeManualDishes)([]);
            ok("recognizeManualDishes 空数组时返回 dishes 数组", Array.isArray(res.dishes));
            ok("recognizeManualDishes 失败时 dishes 为空", res.dishes.length === 0 || !!res.error);
        }
        catch (e) {
            ok("recognizeManualDishes 失败不抛异常", false, String(e));
        }
    });
}
/** 运行所有测试 */
function runAllTests() {
    return __awaiter(this, void 0, void 0, function* () {
        results.length = 0;
        console.log("\n========== 洋菜单 服务层测试 ==========\n");
        yield testGetRecentRecords();
        yield testGetRecordByIdEmpty();
        yield testRecognizeMenuFail();
        yield testRecognizeMenuStructure();
        yield testRecognizeManualDishesFail();
        const passed = results.filter((r) => r.pass).length;
        const failed = results.filter((r) => !r.pass).length;
        console.log("\n========== 结果 ==========");
        console.log(`通过: ${passed}  失败: ${failed}`);
        return { passed, failed, results };
    });
}
