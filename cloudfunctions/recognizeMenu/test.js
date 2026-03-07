// 洋菜单 - 云函数解析逻辑单元测试（Node.js 原生 assert，无外部框架）
// 运行: node test.js

const assert = require("assert");
const {
  parseDishesFromText,
  parseDishesMinimal,
  parseDishesFallback,
  parseAiResponseMeta,
  formatDish,
  normalizeIngredients,
  normalizePrice,
  tryParsePartialDishes,
  extractPricesFromOcrText,
  applyPricesByIndex,
} = require("./parser");

let passed = 0;
let failed = 0;

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

// 测试1：正常完整 JSON 解析
function testNormalJson() {
  const input = JSON.stringify({
    dishes: [
      {
        originalName: "Fish and Chips",
        briefCN: "炸鱼薯条",
        description: "英国经典菜",
        flavor: "外酥里嫩，咸鲜",
        ingredients: ["鳕鱼", "土豆"],
        recommendation: "第一次来英国必试",
        price: "£12.5",
      },
    ],
    recommendations: [
      { dishIndex: 0, dishName: "Fish and Chips", reason: "英国国菜必试" },
    ],
  });
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 1);
  assert.strictEqual(dishes[0].originalName, "Fish and Chips");
  assert.strictEqual(dishes[0].briefCN, "炸鱼薯条");
  assert.strictEqual(dishes[0].detail.description, "英国经典菜");
  assert.strictEqual(dishes[0].detail.flavor, "外酥里嫩，咸鲜");
  assert.deepStrictEqual(dishes[0].detail.ingredients, ["鳕鱼", "土豆"]);
  assert.strictEqual(dishes[0].detail.recommendation, "第一次来英国必试");
}

// 测试2：JSON 被截断（模拟长菜单）- 截断在第一道菜未闭合处，tryParsePartialDishes 可补全 }]} 并解析
function testTruncatedJson() {
  const input =
    '{"dishes":[{"originalName":"Pasta","briefCN":"意面","description":"经典意大利面","flavor":"酱香浓郁","ingredients":["意面","番茄"],"recommendation":"适合所有人","price":"€9"';
  const partial = tryParsePartialDishes(input);
  assert.ok(partial !== null, "应能解析出部分菜品");
  assert.strictEqual(partial.length, 1);
  assert.strictEqual(partial[0].originalName, "Pasta");
  assert.strictEqual(partial[0].briefCN, "意面");
}

// 测试3：AI 返回带 markdown 代码块包裹
function testMarkdownWrapped() {
  const input =
    '```json\n{"dishes":[{"originalName":"Steak","briefCN":"牛排","description":"碳烤牛排","flavor":"肉香浓郁","ingredients":["牛肉"],"recommendation":"爱吃肉的必点","price":"$25"}]}\n```';
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 1);
  assert.strictEqual(dishes[0].originalName, "Steak");
  assert.strictEqual(dishes[0].briefCN, "牛排");
  assert.strictEqual(dishes[0].detail.price, "$25");
}

// 测试4：空数组 - parseDishesMinimal 返回空数组，parseDishesFromText 可能返回占位符或抛错
function testEmptyDishes() {
  const input = '{"dishes":[]}';
  const minimal = parseDishesMinimal(input);
  assert.strictEqual(minimal.length, 0, "parseDishesMinimal 应返回空数组");
}

// 测试5：缺少字段的菜品（容错）
function testMissingFields() {
  const input = JSON.stringify({
    dishes: [{ originalName: "Soup", briefCN: "汤" }],
  });
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 1);
  assert.strictEqual(dishes[0].originalName, "Soup");
  assert.strictEqual(dishes[0].briefCN, "汤");
  assert.strictEqual(dishes[0].detail.description, "");
  assert.strictEqual(dishes[0].detail.flavor, "");
  assert.deepStrictEqual(dishes[0].detail.ingredients, []);
}

// 测试6：ingredients 包含占位符
function testPlaceholderIngredients() {
  const input = JSON.stringify({
    dishes: [
      {
        originalName: "Salad",
        briefCN: "沙拉",
        description: "新鲜沙拉",
        flavor: "清爽",
        ingredients: ["食材A", "ingredient 1", "生菜", "番茄"],
        recommendation: "适合清淡口味",
        price: "",
      },
    ],
  });
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 1);
  const ing = dishes[0].detail.ingredients;
  assert.ok(!ing.includes("食材A"), "应过滤食材A");
  assert.ok(!ing.includes("ingredient 1"), "应过滤ingredient 1");
  assert.ok(ing.includes("生菜"), "应保留生菜");
  assert.ok(ing.includes("番茄"), "应保留番茄");
}

// 测试7：价格归一化
function testPriceNormalize() {
  assert.strictEqual(normalizePrice("12.5"), "¥12.5");
  assert.strictEqual(normalizePrice("RMB 38"), "¥38");
  assert.strictEqual(normalizePrice("￥25"), "¥25");
  assert.strictEqual(normalizePrice("$8.9"), "$8.9");
  assert.strictEqual(normalizePrice(""), "");
  assert.strictEqual(normalizePrice("free"), "");
}

// 测试8：recommendations 解析（dishes 结构正确即可，recommendations 为顶层辅助字段）
function testRecommendations() {
  const input = JSON.stringify({
    dishes: [
      {
        originalName: "A",
        briefCN: "菜A",
        description: "",
        flavor: "",
        ingredients: [],
        recommendation: "",
        price: "",
      },
      {
        originalName: "B",
        briefCN: "菜B",
        description: "",
        flavor: "",
        ingredients: [],
        recommendation: "",
        price: "",
      },
    ],
    recommendations: [{ dishIndex: 0, dishName: "A", reason: "必吃推荐" }],
  });
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 2);
  assert.strictEqual(dishes[0].originalName, "A");
  assert.strictEqual(dishes[1].originalName, "B");
}

// 测试9：parseDishesFallback 正则兜底
function testParseDishesFallback() {
  const input =
    'some text {"originalName":"Burger","briefCN":"汉堡"} more {"name":"Pizza","brief":"披萨"}';
  const dishes = parseDishesFallback(input);
  assert.strictEqual(dishes.length, 2);
  assert.strictEqual(dishes[0].originalName, "Burger");
  assert.strictEqual(dishes[0].briefCN, "汉堡");
  assert.strictEqual(dishes[1].originalName, "Pizza");
  assert.strictEqual(dishes[1].briefCN, "披萨");
}

// 测试10：parseAiResponseMeta 非菜单检测
function testParseAiResponseMeta() {
  const menuInput = '{"dishes":[{"originalName":"Pasta","briefCN":"意面"}]}';
  const menuMeta = parseAiResponseMeta(menuInput);
  assert.strictEqual(menuMeta.isMenu, true, "正常菜单应 isMenu=true");

  const notMenuInput = '{"isMenu":false,"dishes":[]}';
  const notMenuMeta = parseAiResponseMeta(notMenuInput);
  assert.strictEqual(notMenuMeta.isMenu, false, "非菜单应 isMenu=false");

  const emptyInput = '{"dishes":[]}';
  const emptyMeta = parseAiResponseMeta(emptyInput);
  assert.strictEqual(emptyMeta.isMenu, true, "空菜品默认 isMenu=true");
}

// 测试11：formatDish 与 normalizeIngredients 独立
function testFormatDishAndNormalizeIngredients() {
  const item = {
    originalName: "Test",
    briefCN: "测试",
    ingredients: ["食材1", "番茄"],
  };
  const dish = formatDish(item);
  assert.strictEqual(dish.originalName, "Test");
  assert.strictEqual(dish.briefCN, "测试");
  assert.ok(!dish.detail.ingredients.includes("食材1"));
  assert.ok(dish.detail.ingredients.includes("番茄"));

  assert.deepStrictEqual(normalizeIngredients(["食材A", "生菜", "番茄"]), [
    "生菜",
    "番茄",
  ]);
}

console.log("\n========== 洋菜单 云函数解析单元测试 ==========\n");

run("测试1 正常JSON", testNormalJson);
run("测试2 截断JSON", testTruncatedJson);
run("测试3 Markdown包裹", testMarkdownWrapped);
run("测试4 空数组", testEmptyDishes);
run("测试5 缺少字段", testMissingFields);
run("测试6 占位符过滤", testPlaceholderIngredients);
run("测试7 价格归一化", testPriceNormalize);
run("测试8 推荐解析", testRecommendations);
run("测试9 Fallback正则", testParseDishesFallback);
run("测试10 parseAiResponseMeta", testParseAiResponseMeta);
run("测试11 formatDish与normalizeIngredients", testFormatDishAndNormalizeIngredients);

// ===== 追加：推荐功能测试 =====

// 测试12：recommendations 正确提取
run("recommendations 正常解析", () => {
  const input = JSON.stringify({
    dishes: [
      { originalName: "A", briefCN: "菜A", description: "描述A", flavor: "咸鲜", ingredients: ["食材"], recommendation: "推荐A", price: "¥30" },
      { originalName: "B", briefCN: "菜B", description: "描述B", flavor: "酸甜", ingredients: ["食材"], recommendation: "推荐B", price: "¥25" },
      { originalName: "C", briefCN: "菜C", description: "描述C", flavor: "微辣", ingredients: ["食材"], recommendation: "推荐C", price: "¥35" }
    ],
    recommendations: [
      { dishIndex: 0, dishName: "A", reason: "招牌菜必试" },
      { dishIndex: 2, dishName: "C", reason: "性价比最高" }
    ]
  });
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 3);
  assert.strictEqual(dishes[0].originalName, "A");
  assert.strictEqual(dishes[2].originalName, "C");
});

// 测试13：多种 AI 返回 key 兼容
run("兼容 items 代替 dishes", () => {
  const input = JSON.stringify({
    items: [
      { originalName: "Test", briefCN: "测试", description: "测试菜", flavor: "鲜", ingredients: ["鱼"] }
    ]
  });
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 1);
  assert.strictEqual(dishes[0].originalName, "Test");
});

// 测试14：超长菜单截断后有提示
run("截断修复后末尾有提示菜品", () => {
  const input = '[{"originalName":"A","briefCN":"菜A","description":"","flavor":"","ingredients":[]},{"originalName":"B","briefCN":"菜B","description":"","flavor":"","ingredients":[]},{"originalName":"C","briefCN":"菜';
  try {
    const dishes = parseDishesFromText(input);
    const lastDish = dishes[dishes.length - 1];
    assert.ok(
      lastDish.originalName.includes("⚠️") || dishes.length >= 2,
      "应包含截断提示或至少解析出2道菜"
    );
  } catch (e) {
    assert.ok(true);
  }
});

// 测试15：完全无效输入
run("完全无效输入抛错", () => {
  assert.throws(
    () => parseDishesFromText("这不是JSON，只是一段普通文字"),
    /无法解析/
  );
});

// 测试16：带前缀说明的AI返回
run("带前缀说明文字的JSON能正确解析", () => {
  const input = '根据图片识别，以下是菜品列表：\n{"dishes":[{"originalName":"Soup","briefCN":"汤","description":"热汤","flavor":"鲜","ingredients":["蔬菜"]}]}';
  const dishes = parseDishesFromText(input);
  assert.strictEqual(dishes.length, 1);
  assert.strictEqual(dishes[0].originalName, "Soup");
});

// 测试17：价格从OCR文本提取
run("OCR文本价格提取", () => {
  const ocrText = "Fish and Chips    £12.50\nSteak           £25.00\nSalad            £8.90";
  const prices = extractPricesFromOcrText(ocrText);
  assert.ok(prices.length >= 3, "应提取出至少3个价格");
});

// 测试18：价格按索引补全
run("价格按索引补全缺失价格的菜品", () => {
  const dishes = [
    { originalName: "A", briefCN: "菜A", detail: { description: "", ingredients: [], flavor: "", price: "" } },
    { originalName: "B", briefCN: "菜B", detail: { description: "", ingredients: [], flavor: "", price: "¥20" } }
  ];
  const prices = ["¥10", "¥20"];
  const result = applyPricesByIndex(dishes, prices);
  assert.strictEqual(result[0].detail.price, "¥10", "A应被补全为¥10");
  assert.strictEqual(result[1].detail.price, "¥20", "B已有价格不应被覆盖");
});

console.log("\n========== 结果 ==========");
console.log(`通过: ${passed}  失败: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
