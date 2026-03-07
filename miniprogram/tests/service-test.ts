/**
 * 洋菜单 - 前端服务层测试（微信开发者工具控制台手动运行）
 * 使用方式：在控制台输入 runAllTests() 或 require('./tests/service-test').runAllTests()
 * 需在 app.json 中注册测试页面或在任意页面中 require 后挂到全局
 */

import { recognizeMenu, recognizeManualDishes } from "../services/ai";
import {
  getRecentRecords,
  getRecordById,
  type RecentRecordItem,
} from "../services/history";

const results: { name: string; pass: boolean; msg?: string }[] = [];

function ok(name: string, pass: boolean, msg?: string) {
  results.push({ name, pass, msg });
  console.log(pass ? `  ✅ ${name}` : `  ❌ ${name}${msg ? ": " + msg : ""}`);
}

/** 测试 history.getRecentRecords 返回格式 */
async function testGetRecentRecords() {
  try {
    const list = await getRecentRecords(3);
    if (!Array.isArray(list)) {
      ok("getRecentRecords 返回数组", false, "返回类型非数组");
      return;
    }
    ok("getRecentRecords 返回数组", true);
    if (list.length > 0) {
      const item = list[0] as RecentRecordItem;
      const hasId = "_id" in item;
      const hasTimeText = "timeText" in item;
      const hasDishSummary = "dishSummary" in item;
      const hasDishCount = "dishCount" in item;
      ok(
        "getRecentRecords 项含 _id/timeText/dishSummary/dishCount",
        hasId && hasTimeText && hasDishSummary && hasDishCount
      );
    } else {
      ok("getRecentRecords 空记录返回空数组", list.length === 0);
    }
  } catch (e) {
    ok("getRecentRecords", false, String(e));
  }
}

/** 测试 history.getRecordById 空 ID 返回 null */
async function testGetRecordByIdEmpty() {
  try {
    const r = await getRecordById("");
    ok("getRecordById 空 ID 返回 null", r === null);
  } catch (e) {
    ok("getRecordById 空 ID", false, String(e));
  }
}

/** 测试 ai.recognizeMenu 失败时返回 { dishes: [] } 不抛异常 */
async function testRecognizeMenuFail() {
  try {
    const res = await recognizeMenu("invalid-file-id-xxx", false);
    const hasDishes = Array.isArray(res.dishes);
    const noThrow = true;
    ok("recognizeMenu 失败时返回 dishes 数组", hasDishes);
    ok("recognizeMenu 失败时不抛异常", noThrow);
    ok(
      "recognizeMenu 失败时 dishes 为空",
      res.dishes.length === 0 && !!res.error
    );
  } catch (e) {
    ok("recognizeMenu 失败时不抛异常", false, "抛出了异常: " + String(e));
  }
}

/** 测试 ai.recognizeMenu 返回值结构包含 dishes */
async function testRecognizeMenuStructure() {
  try {
    const res = await recognizeMenu("invalid-file-id-structure-test", false);
    const hasDishes = "dishes" in res && Array.isArray(res.dishes);
    ok("recognizeMenu 返回值含 dishes 数组", hasDishes);
    if (res.dishes.length > 0) {
      const d = res.dishes[0];
      ok(
        "dishes 项含 originalName/briefCN/detail",
        "originalName" in d && "briefCN" in d && "detail" in d
      );
    }
  } catch (e) {
    ok("recognizeMenu 结构", false, String(e));
  }
}

/** 测试 ai.recognizeManualDishes 失败时返回 { dishes: [] } */
async function testRecognizeManualDishesFail() {
  try {
    const res = await recognizeManualDishes([]);
    ok(
      "recognizeManualDishes 空数组时返回 dishes 数组",
      Array.isArray(res.dishes)
    );
    ok(
      "recognizeManualDishes 失败时 dishes 为空",
      res.dishes.length === 0 || !!res.error
    );
  } catch (e) {
    ok("recognizeManualDishes 失败不抛异常", false, String(e));
  }
}

/** 运行所有测试 */
export async function runAllTests() {
  results.length = 0;
  console.log("\n========== 洋菜单 服务层测试 ==========\n");

  await testGetRecentRecords();
  await testGetRecordByIdEmpty();
  await testRecognizeMenuFail();
  await testRecognizeMenuStructure();
  await testRecognizeManualDishesFail();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log("\n========== 结果 ==========");
  console.log(`通过: ${passed}  失败: ${failed}`);
  return { passed, failed, results };
}
