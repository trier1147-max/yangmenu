# 洋菜单 测试报告

**生成时间**: 2025-03-07  
**测试范围**: 云函数单元测试、前端服务层测试说明

---

## 1. 云函数单元测试

### 1.1 getUserInfo 次数限制逻辑

**路径**: `cloudfunctions/getUserInfo/test.js`  
**运行命令**: `cd cloudfunctions/getUserInfo && node test.js`

| 结果 | 数量 |
|------|------|
| ✅ 通过 | 31 |
| ❌ 失败 | 0 |

**覆盖项**:
- 基础限额：初始 6 次、使用后剩余、不会为负
- consume 判断：0/6 可消费、6/6 不可消费、有分享奖励后 6/8 可消费
- 分享奖励：bonus 从 0→2→4→6 递增、上限 6
- canShare 判断：bonus 0–4 可分享、6 不可分享
- 分享后继续使用：8/8 不可消费、12/12 不可消费
- 日期重置：昨天/今天/空日期
- 边界组合：0+6、11+6

### 1.2 recognizeMenu 解析逻辑

**路径**: `cloudfunctions/recognizeMenu/test.js`  
**运行命令**: `cd cloudfunctions/recognizeMenu && node test.js`

| 结果 | 数量 |
|------|------|
| ✅ 通过 | 18 |
| ❌ 失败 | 0 |

**覆盖项**:
- 正常 JSON、截断 JSON、Markdown 包裹
- 空数组、缺少字段、占位符过滤
- 价格归一化、推荐解析、Fallback 正则
- parseAiResponseMeta、formatDish、normalizeIngredients
- recommendations 兼容、items 代替 dishes
- 截断修复、无效输入、带前缀说明的 JSON
- OCR 价格提取、价格按索引补全

---

## 2. 前端服务层测试

**路径**: `miniprogram/tests/service-test.ts`  
**运行方式**: 在微信开发者工具控制台执行 `runAllTests()` 或 `require('./tests/service-test').runAllTests()`

**说明**: 需在微信小程序环境中运行，依赖云函数与云数据库。当前无法在 Node 环境中自动执行。

**测试项**:
- getRecentRecords 返回格式
- getRecordById 空 ID 返回 null
- recognizeMenu 失败时返回 { dishes: [] } 不抛异常
- recognizeMenu 返回值结构含 dishes
- recognizeManualDishes 空数组时返回 dishes 数组
- checkUsage 返回 remaining、total、canShare
- consumeUsage 返回 boolean
- addShareBonus 返回 success、newRemaining
- 菜品字段完整性（originalName、briefCN、detail、ingredients、flavor）
- 推荐功能（dishIndex、dishName、reason）
- deleteRecordById 无效 ID 不崩溃

---

## 3. 测试清单

**路径**: `miniprogram/TEST_CHECKLIST.md`

功能清单覆盖：次数限制、AI 推荐、菜品详情、历史记录、多语言、多图拍摄、长菜单、异常场景、真机、分享、上线前确认。

---

## 4. 汇总

| 测试类型 | 通过 | 失败 | 状态 |
|----------|------|------|------|
| getUserInfo 单元测试 | 31 | 0 | ✅ 全部通过 |
| recognizeMenu 单元测试 | 18 | 0 | ✅ 全部通过 |
| 前端服务层测试 | 需手动运行 | - | 待执行 |

**云函数单元测试**: 49 个用例全部通过。

---

## 5. 附录：运行命令

```bash
# 运行所有云函数单元测试
cd cloudfunctions/getUserInfo && node test.js
cd cloudfunctions/recognizeMenu && node test.js
```
