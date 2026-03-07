// 洋菜单 - getUserInfo 次数限制逻辑单元测试
// 运行: node test.js

const assert = require("assert");
let passed = 0,
  failed = 0;

function run(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

const BASE_LIMIT = 6;
const SHARE_BONUS = 2;
const MAX_LIMIT = 12;
const MAX_BONUS = MAX_LIMIT - BASE_LIMIT; // 6

function calcRemaining(dailyUsage, dailyBonus) {
  return Math.max(0, BASE_LIMIT + dailyBonus - dailyUsage);
}
function calcTotal(dailyBonus) {
  return BASE_LIMIT + dailyBonus;
}
function canConsume(dailyUsage, dailyBonus) {
  return dailyUsage < BASE_LIMIT + dailyBonus;
}
function canShare(dailyBonus) {
  return BASE_LIMIT + dailyBonus < MAX_LIMIT;
}
function addBonus(dailyBonus) {
  return Math.min(dailyBonus + SHARE_BONUS, MAX_BONUS);
}
function shouldReset(lastUsageDate) {
  const today = new Date().toISOString().slice(0, 10);
  return lastUsageDate !== today;
}

console.log("\n========== getUserInfo 次数限制逻辑测试 ==========\n");

// 基础限额
run("初始状态: 剩余6次", () => assert.strictEqual(calcRemaining(0, 0), 6));
run("初始状态: 总额6", () => assert.strictEqual(calcTotal(0), 6));
run("使用1次后剩余5", () => assert.strictEqual(calcRemaining(1, 0), 5));
run("使用5次后剩余1", () => assert.strictEqual(calcRemaining(5, 0), 1));
run("使用6次后剩余0", () => assert.strictEqual(calcRemaining(6, 0), 0));
run("使用7次不会为负数", () => assert.strictEqual(calcRemaining(7, 0), 0));

// consume 判断
run("0/6 可以consume", () => assert.strictEqual(canConsume(0, 0), true));
run("5/6 可以consume", () => assert.strictEqual(canConsume(5, 0), true));
run("6/6 不可以consume", () => assert.strictEqual(canConsume(6, 0), false));
run("6/8 可以consume（有分享奖励）", () => assert.strictEqual(canConsume(6, 2), true));
run("8/8 不可以consume", () => assert.strictEqual(canConsume(8, 2), false));
run("12/12 不可以consume", () => assert.strictEqual(canConsume(12, 6), false));

// 分享奖励
run("分享1次: bonus从0变2", () => assert.strictEqual(addBonus(0), 2));
run("分享2次: bonus从2变4", () => assert.strictEqual(addBonus(2), 4));
run("分享3次: bonus从4变6", () => assert.strictEqual(addBonus(4), 6));
run("分享4次: bonus仍为6（上限）", () => assert.strictEqual(addBonus(6), 6));
run("分享后总额: bonus=2时总额8", () => assert.strictEqual(calcTotal(2), 8));
run("分享后总额: bonus=4时总额10", () => assert.strictEqual(calcTotal(4), 10));
run("分享后总额: bonus=6时总额12", () => assert.strictEqual(calcTotal(6), 12));

// canShare 判断
run("bonus=0 可以分享", () => assert.strictEqual(canShare(0), true));
run("bonus=2 可以分享", () => assert.strictEqual(canShare(2), true));
run("bonus=4 可以分享", () => assert.strictEqual(canShare(4), true));
run("bonus=6 不可以分享（已达上限）", () => assert.strictEqual(canShare(6), false));

// 分享后继续使用
run("用完6次+分享后剩余2", () => assert.strictEqual(calcRemaining(6, 2), 2));
run("用完8次+分享两次后剩余2", () => assert.strictEqual(calcRemaining(8, 4), 2));
run("用完12次后剩余0", () => assert.strictEqual(calcRemaining(12, 6), 0));

// 日期重置
run("昨天的日期应重置", () => assert.strictEqual(shouldReset("2025-01-01"), true));
run("今天的日期不重置", () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.strictEqual(shouldReset(today), false);
});
run("空日期应重置", () => assert.strictEqual(shouldReset(""), true));

// 边界组合
run("边界: 用了0次+bonus=6 剩余12", () => assert.strictEqual(calcRemaining(0, 6), 12));
run("边界: 用了11次+bonus=6 剩余1", () => assert.strictEqual(calcRemaining(11, 6), 1));

console.log(`\n通过: ${passed}  失败: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
