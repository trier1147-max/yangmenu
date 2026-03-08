// 洋菜单 - 菜品解析模块，纯逻辑无外部依赖，便于单元测试
// 常见食材英文→中文映射，用于兜底确保中国用户不看到英文
const INGREDIENT_ZH_MAP = {
  // 蔬菜类
  lettuce: "生菜", salad: "沙拉", tomato: "番茄", tomatoes: "番茄",
  onion: "洋葱", onions: "洋葱", garlic: "大蒜", ginger: "姜",
  spinach: "菠菜", broccoli: "西兰花", asparagus: "芦笋", avocado: "牛油果",
  potato: "土豆", potatoes: "土豆", carrot: "胡萝卜", carrots: "胡萝卜",
  "bell pepper": "甜椒", "green pepper": "青椒", chili: "辣椒", "red pepper": "红椒",
  cucumber: "黄瓜", celery: "芹菜", cabbage: "卷心菜", "chinese cabbage": "白菜",
  eggplant: "茄子", zucchini: "西葫芦", pumpkin: "南瓜", corn: "玉米",

  // 肉类
  beef: "牛肉", chicken: "鸡肉", fish: "鱼", pork: "猪肉", lamb: "羊肉", duck: "鸭肉",
  bacon: "培根", ham: "火腿", sausage: "香肠", steak: "牛排", turkey: "火鸡",

  // 海鲜类
  shrimp: "虾", salmon: "三文鱼", cod: "鳕鱼", tuna: "金枪鱼", crab: "蟹",
  lobster: "龙虾", oyster: "生蚝", mussel: "青口", clam: "蛤蜊", squid: "鱿鱼",

  // 乳制品
  cheese: "芝士", milk: "牛奶", cream: "奶油", butter: "黄油",
  parmesan: "帕玛森芝士", mozzarella: "马苏里拉芝士", feta: "羊奶酪",
  cheddar: "切达芝士", "sour cream": "酸奶油", yogurt: "酸奶",

  // 主食类
  pasta: "意面", rice: "米饭", bread: "面包", noodle: "面条", noodles: "面条",
  "rice noodle": "米粉", spaghetti: "意大利面", baguette: "法棍",

  // 调料香料
  basil: "罗勒", pepper: "胡椒", salt: "盐", "olive oil": "橄榄油",
  cilantro: "香菜", parsley: "欧芹", thyme: "百里香", oregano: "牛至",
  rosemary: "迷迭香", mint: "薄荷", "bay leaf": "月桂叶",
  honey: "蜂蜜", vinegar: "醋", "soy sauce": "酱油", mustard: "芥末",
  "sesame oil": "香油", sugar: "糖", "chili oil": "辣椒油",

  // 其他常见食材
  egg: "鸡蛋", eggs: "鸡蛋", mushroom: "蘑菇", mushrooms: "蘑菇",
  lemon: "柠檬", lemons: "柠檬", lime: "青柠", olive: "橄榄", olives: "橄榄",
  coconut: "椰子", almond: "杏仁", walnut: "核桃", peanut: "花生", cashew: "腰果",
  "green onion": "葱", scallion: "葱", "spring onion": "葱",
  tofu: "豆腐", "seaweed": "海苔", nori: "海苔", wasabi: "芥末",
  "maple syrup": "枫糖浆", ketchup: "番茄酱", mayonnaise: "蛋黄酱", mayo: "蛋黄酱",
};

function translateIngredientToZh(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (INGREDIENT_ZH_MAP[lower]) return INGREDIENT_ZH_MAP[lower];
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  return "";
}

function isPlaceholderIngredient(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;

  const normalized = raw
    .toLowerCase()
    .replace(/[：:()（）\[\]【】]/g, "")
    .replace(/\s+/g, "");
  const genericOnly = /^(食材|原料|配料|材料|主料|辅料|佐料|调料|ingredient|ingredients|material|materials|item|food)$/i;
  return (
    genericOnly.test(raw) ||
    /^(食材|原料|配料|材料|主料|辅料|佐料|调料)[a-z0-9一二三四五六七八九十甲乙丙丁]?$/.test(raw) ||
    /(食材|原料|配料|材料|ingredient|material)[-_:： ]?[a-z0-9一二三四五六七八九十甲乙丙丁]+$/i.test(raw) ||
    /^(ingredient|ingredients|material|materials)[-_ ]?[a-z0-9]+$/i.test(raw) ||
    /^(item|food)[-_ ]?[a-z0-9]+$/i.test(raw) ||
    /(示例|样例|占位|placeholder|sample|demo|test|mock)/i.test(raw) ||
    /^(a|b|c|d|e|f|g|1|2|3|4|5|6)$/.test(normalized)
  );
}

function normalizeIngredients(list) {
  if (!Array.isArray(list) && typeof list !== "string") return [];

  const seen = new Set();
  const result = [];
  const rawList = Array.isArray(list) ? list : [list];

  for (const item of rawList) {
    const value = String(item ?? "").trim();
    if (!value) continue;

    const parts = value
      .split(/[、,，;；\/|]/)
      .map((part) =>
        part
          .trim()
          .replace(/^[\-•·\s]+/, "")
          .replace(/^(食材|原料|配料|材料|主料|辅料|佐料|调料)[：:]\s*/i, "")
          .trim()
      )
      .filter(Boolean);

    const candidates = parts.length > 0 ? parts : [value];

    for (const candidate of candidates) {
      if (!candidate || isPlaceholderIngredient(candidate)) continue;
      const zh = translateIngredientToZh(candidate) || candidate;
      if (!zh) continue;
      const key = zh.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(zh);
      if (result.length >= 6) return result;
    }
  }

  return result;
}

/**
 * 从 OCR 文本推断货币符号。
 * 优先级：明确货币符号 > "元"字 > 文字语种推断 > 无法判断（返回空串）
 */
function detectCurrencyFromOcrText(ocrText) {
  if (!ocrText || typeof ocrText !== "string") return "";

  // 1. 统计已出现的货币符号
  const SYMBOL_PATTERNS = [
    ["¥", /[¥￥]/g],
    ["$", /\$/g],
    ["€", /€/g],
    ["£", /£/g],
    ["₩", /₩/g],
    ["฿", /฿/g],
    ["₹", /₹/g],
  ];
  let maxSym = "", maxCount = 0;
  for (const [sym, re] of SYMBOL_PATTERNS) {
    const count = (ocrText.match(re) || []).length;
    if (count > maxCount) { maxCount = count; maxSym = sym; }
  }
  if (maxCount > 0) return maxSym;

  // 2. "元" 出现则为人民币
  if (/元/.test(ocrText)) return "¥";

  // 3. 通过文字语种推断
  const ja = (ocrText.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
  const ko = (ocrText.match(/[\uAC00-\uD7AF]/g) || []).length;
  const zh = (ocrText.match(/[\u4e00-\u9fff]/g) || []).length;
  const la = (ocrText.match(/[a-zA-Z]/g) || []).length;
  const total = ja + ko + zh + la;
  if (total === 0) return "";
  if (ja / total > 0.15) return "¥";  // 日文菜单 → JPY（同符号）
  if (ko / total > 0.15) return "₩";  // 韩文菜单 → KRW
  if (zh / total > 0.3)  return "¥";  // 中文菜单 → CNY

  // 4. 拉丁字母为主（欧美菜单）→ 无法判断货币，不添加符号
  return "";
}

/** 卡路里/营养信息单位，命中则判定为非价格 */
const CALORIE_PATTERN = /\d+\s*(?:kcal|cal|卡路里|千卡|卡|kJ|kj)\b/i;
/** 其他营养/计量单位，紧跟数字后出现时排除 */
const NUTRITION_UNIT_PATTERN = /^(?:kcal|cal|卡路里|千卡|卡|kJ|kj|mg|ml|oz|lb)\b/i;

/**
 * 格式化价格字符串。
 * defaultCurrency：由调用方从 OCR 文本检测后传入，仅对裸数字生效；为空串则不添加货币符号。
 * 若值包含卡路里/营养单位，直接返回空串。
 */
function normalizePrice(value, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // 排除卡路里/营养信息误识别
  if (CALORIE_PATTERN.test(raw)) return "";

  const compact = raw.replace(/\s+/g, "");
  // 裸数字：用检测到的货币符号前缀（无法判断时 defaultCurrency 为空，保留裸数字）
  const withCurrency = compact.replace(/^([0-9]+(?:\.[0-9]{1,2})?)$/, defaultCurrency + "$1");
  const normalized = withCurrency
    .replace(/^RMB/i, "¥")
    .replace(/^￥/, "¥");

  if (normalized.length > 20) return "";
  if (!/[0-9]/.test(normalized)) return "";
  return normalized;
}

/**
 * 从 OCR 文本中按出现顺序提取有明确货币标记的价格。
 * 要求：数字前有货币符号（¥ $ € £ ₩ 等）或后跟"元/円"——裸数字一律不提取，
 * 避免将卡路里、克重等营养信息误识别为价格。
 */
function extractPricesFromOcrText(ocrText) {
  if (!ocrText || typeof ocrText !== "string") return [];

  // 先标记所有卡路里/营养数字的位置范围，提取时跳过
  const calorieRanges = [];
  const caloriePat = /\d+\s*(?:kcal|cal|卡路里|千卡|卡|kJ|kj|mg\b|ml\b)/gi;
  let cm;
  while ((cm = caloriePat.exec(ocrText)) !== null) {
    calorieRanges.push([cm.index, cm.index + cm[0].length]);
  }
  const isCalorie = (idx) => calorieRanges.some(([s, e]) => idx >= s && idx < e);

  const results = [];
  // 只匹配带明确货币标记的数字：
  //   1. 货币符号前缀：¥38 / $8.9 / €12 / RMB38
  //   2. 元/円 后缀：38元 / 38円
  const regex = /(?:[¥￥$€£₩฿₹]|RMB\s*)(\d{1,5}(?:\.\d{1,2})?)|(\d{1,5}(?:\.\d{1,2})?)\s*(?:元|円)\b/gi;
  let m2;
  while ((m2 = regex.exec(ocrText)) !== null) {
    if (isCalorie(m2.index)) continue;
    const numStr = m2[1] ?? m2[2];
    const num = parseFloat(numStr);
    if (Number.isFinite(num) && num >= 0.01 && num <= 99999) {
      results.push(m2[0].trim());
    }
  }
  return results;
}

function normalizeOptionRule(rule, min, max) {
  const raw = String(rule ?? "").trim();
  if (raw) return raw.slice(0, 30);

  const minNum = Number(min);
  const maxNum = Number(max);
  if (Number.isFinite(minNum) && Number.isFinite(maxNum)) {
    if (minNum === maxNum && minNum > 0) return `${minNum}选${maxNum}`;
    if (minNum > 0 && maxNum > 0) return `${minNum}-${maxNum}选`;
    if (maxNum > 0) return `最多选${maxNum}`;
  }
  return "";
}

function normalizeOptionGroups(value) {
  if (!Array.isArray(value)) return [];
  const groups = [];

  for (const item of value) {
    const group = String(item?.group ?? item?.name ?? item?.title ?? "").trim();
    const rule = normalizeOptionRule(item?.rule, item?.min, item?.max);
    const srcChoices = Array.isArray(item?.choices)
      ? item.choices
      : Array.isArray(item?.items)
      ? item.items
      : Array.isArray(item?.options)
      ? item.options
      : [];

    const seen = new Set();
    const choices = [];
    for (const c of srcChoices) {
      const text =
        typeof c === "string"
          ? c.trim()
          : String(c?.name ?? c?.label ?? c?.value ?? "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      choices.push(text);
      if (choices.length >= 12) break;
    }

    if (!group && !rule && choices.length === 0) continue;
    groups.push({ group, rule, choices });
    if (groups.length >= 6) break;
  }

  return groups;
}

function normalizeDietaryTags(value) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(["GF", "DF", "V", "VG", "VEG", "NF", "SF", "N", "P", "KETO"]);
  const seen = new Set();
  const tags = [];

  for (const item of value) {
    const tag = String(item ?? "").trim().toUpperCase();
    if (!tag || tag.length > 8) continue;
    if (!allowed.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}

/** 移除所有外文：过滤掉任何非中文为主的内容（英、法、德、西、意、日假名、韩文等） */
function sanitizeChineseText(text) {
  if (!text || typeof text !== "string") return "";
  const trimmed = text.trim();

  // 统计字符类型
  const chineseChars = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length; // 中文汉字
  // 外文字符：拉丁字母（英法德西意）、西里尔字母（俄语）、日文假名、韩文等
  const foreignChars = (trimmed.match(/[a-zA-ZÀ-ÿāēīōūǎǐěǒǔàèìòùáéíóúäëïöüâêîôûãõñçşğıßØøÆæþðÞÐ\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g) || []).length;
  const totalMeaningfulChars = chineseChars + foreignChars;

  // 如果整段文本外文占比超过 70%，直接返回空
  if (totalMeaningfulChars > 0 && foreignChars / totalMeaningfulChars > 0.7) {
    return "";
  }

  // 如果整段文本没有中文，直接返回空
  if (chineseChars === 0 && foreignChars > 0) {
    return "";
  }

  // 按句子分割（中英文标点都支持），过滤掉纯外文句子
  const sentences = trimmed.split(/[。！？\n.!?]+/).filter(Boolean);
  const chineseSentences = sentences.filter(sentence => {
    const sChinese = (sentence.match(/[\u4e00-\u9fff]/g) || []).length;
    const sForeign = (sentence.match(/[a-zA-ZÀ-ÿāēīōūǎǐěǒǔàèìòùáéíóúäëïöüâêîôûãõñçşğıßØøÆæþðÞÐ\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g) || []).length;
    const sTotal = sChinese + sForeign;

    if (sTotal === 0) return false; // 空句子或纯符号

    // 保留中文占比至少 40% 的句子
    if (sChinese / sTotal >= 0.4) return true;

    // 或者句子很短（≤6 字符）且包含中文（可能是专有名词如"提拉米苏"）
    if (sentence.length <= 6 && sChinese > 0) return true;

    return false;
  });

  let result = chineseSentences.join("。").trim();

  // 移除孤立的外文单词（前后是中文或标点的外文词）
  // 匹配：前面是中文/标点/开头 + 连续外文字母 + 后面是中文/标点/结尾
  result = result.replace(/(?<=[\u4e00-\u9fff\s，。、！？：；""''（）\[\]《》]|^)[a-zA-ZÀ-ÿāēīōūǎǐěǒǔàèìòùáéíóúäëïöüâêîôûãõñçşğıßØøÆæþðÞÐ\u0400-\u04FF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]{2,}(?=[\u4e00-\u9fff\s，。、！？：；""''（）\[\]《》]|$)/g, "");

  // 清理多余的标点和空格
  result = result
    .replace(/[,，]\s*[,，]/g, "，")
    .replace(/[。.]\s*[。.]/g, "。")
    .replace(/\s+([，。、！？：；,.])/g, "$1") // 移除标点前的残留空格（外文词删除后的遗留）
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[，。、！？：；]\s*/g, "") // 移除开头的标点
    .replace(/\s*[，。、！？：；]\s*$/g, "") // 移除结尾的标点
    .trim();

  return result;
}

function formatDish(item, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  const detail = item?.detail ?? item?.details ?? {};
  const background = String(
    item?.background ?? item?.story ?? detail?.background ?? detail?.story ?? detail?.特色 ?? ""
  ).trim();
  const recommendation = String(
    item?.recommendation ??
      item?.suggestion ??
      detail?.recommendation ??
      detail?.suggestion ??
      detail?.适合人群 ??
      ""
  ).trim();
  const legacyDescription = String(
    item?.description ?? detail?.description ?? detail?.做法 ?? detail?.简介 ?? ""
  ).trim();
  const mergedIntro = [background, legacyDescription].filter(Boolean).join("\n").trim() || "";
  const price = normalizePrice(
    item?.price ??
      item?.priceText ??
      item?.cost ??
      item?.amount ??
      item?.价格 ??
      detail?.price ??
      detail?.priceText ??
      detail?.cost ??
      detail?.amount ??
      detail?.价格,
    defaultCurrency
  );
  const options = normalizeOptionGroups(
    item?.options ?? item?.optionGroups ?? item?.addons ?? detail?.options ?? detail?.optionGroups
  );
  const dietaryTags = normalizeDietaryTags(
    item?.dietaryTags ?? item?.tags ?? item?.labels ?? detail?.dietaryTags ?? detail?.tags
  );

  // 强制中文化：移除中外文夹杂
  const sanitizedIntro = sanitizeChineseText(mergedIntro);
  const sanitizedFlavor = sanitizeChineseText(String(item?.flavor ?? detail?.flavor ?? detail?.风味 ?? "").trim());
  const sanitizedRecommendation = sanitizeChineseText(recommendation);

  return {
    originalName: String(item?.originalName ?? item?.name ?? "").trim(),
    briefCN: String(item?.briefCN ?? item?.brief ?? "").trim(),
    detail: {
      description: sanitizedIntro,
      introduction: sanitizedIntro,
      ingredients: normalizeIngredients(item?.ingredients ?? detail?.ingredients),
      flavor: sanitizedFlavor,
      price,
      options,
      dietaryTags,
      recommendation: sanitizedRecommendation,
    },
  };
}

/** 若解析结果有顶层 prices 数组，按索引为缺失 price 的菜品补全 */
function applyPricesByIndex(dishes, pricesArray, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  if (!Array.isArray(dishes) || !Array.isArray(pricesArray) || pricesArray.length === 0)
    return dishes;
  return dishes.map((d, i) => {
    const existing = String((d.detail && d.detail.price) || "").trim();
    if (existing) return d;
    const p = normalizePrice(pricesArray[i], defaultCurrency);
    if (!p) return d;
    return {
      ...d,
      detail: d.detail ? { ...d.detail, price: p } : { description: "", introduction: "", ingredients: [], flavor: "", price: p, options: [] },
    };
  });
}

/**
 * 语义过滤：检测一条记录是否明显不是菜品（餐厅名/地址/电话/分类标题等）。
 * 返回 true 表示应该被过滤掉。
 */
function isLikelyNonDish(originalName, briefCN) {
  const name = String(originalName || "").trim();
  const brief = String(briefCN || "").trim();
  if (!name && !brief) return true;

  const nameLower = name.toLowerCase();
  const combined = (nameLower + " " + brief).toLowerCase();

  // 电话号码（纯数字+符号，7位以上）
  if (/^[\d\s\-+().]{7,}$/.test(name)) return true;
  if (/(?:tel|fax|phone|电话|传真)[:\s]/i.test(combined)) return true;

  // 地址
  if (/\b(?:street|road|ave(?:nue)?|blvd|boulevard|lane|drive|floor|suite|bldg|building)\b/i.test(nameLower)) return true;
  if (/(?:地址|路\d|号楼|#\d)/.test(combined)) return true;

  // URL / 邮箱
  if (/(?:www\.|\.com|\.net|\.org|\.co\.|@[\w.]|https?:)/i.test(combined)) return true;

  // 营业时间
  if (/\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b.*\d/i.test(nameLower)) return true;
  if (/\d{1,2}[:.]\d{2}\s*[-–~]\s*\d{1,2}[:.]\d{2}/.test(name)) return true;
  if (/(?:营业时间|opening\s*hours?|hours?\s*of\s*operation)/i.test(combined)) return true;

  // 纯分类标题（originalName 整体匹配才过滤，避免误杀含这些词的菜名）
  const headerRe = /^(starters?|appetizers?|mains?|main\s+courses?|entrées?|entrees?|desserts?|beverages?|drinks?|sides?|side\s+dishes?|soups?|salads?|specials?|daily\s+specials?|cocktails?|wine\s*list|beer|spirits?|brunch|breakfast|lunch|dinner|前菜|主菜|主食|甜品|甜点|饮品|饮料|酒水|汤类|沙拉|小食|特色菜|热菜|凉菜|粥类|面点)$/i;
  if (headerRe.test(name.trim())) return true;

  // briefCN 里明确标注非菜品内容
  if (/(?:餐厅|饭店|酒吧|咖啡馆|地址|电话|营业|时间|分类|标题|版权|页码|联系|支付|服务费|小费)/.test(brief)) return true;

  // 支付 / 服务费
  if (/\b(?:visa|mastercard|amex|cash\s+only|service\s+charge|gratuity)\b/i.test(combined)) return true;

  // 版权 / 页码
  if (/(?:©|copyright|\ball\s+rights\b|page\s*\d)/i.test(combined)) return true;

  // 社交媒体
  if (/\b(?:instagram|facebook|twitter|tiktok|follow\s+us)\b/i.test(combined)) return true;
  if (/(?:关注我们|微信公众号|微博)/.test(combined)) return true;

  // 英文说明/提示类（易被误识别为菜品）
  const instructionPatterns = [
    /\ballergen\s*(?:info|information)?\b/i,
    /\bgluten[- ]?free\s*(?:options?|available)?\b/i,
    /\bplease\s+contact\s+(?:us|staff)\b/i,
    /\bterms?\s+(?:and|&)\s+conditions?\b/i,
    /\bingredients?\s+may\s+vary\b/i,
    /\bsubject\s+to\s+availability\b/i,
    /\b(?:service\s+charge|gratuity)\s+(?:not\s+)?included\b/i,
    /\b(?:allergy|dietary)\s+(?:info|information|notice)\b/i,
    /\b(?:we\s+)?accept\s+(?:cash|card|credit)\b/i,
    /\b(?:no\s+)?substitutions?\s+(?:please|allowed)\b/i,
    /\b(?:prices?|menu)\s+subject\s+to\s+change\b/i,
    /\b(?:for\s+)?(?:more\s+)?information\s+(?:please\s+)?(?:contact|ask)\b/i,
    /\b(?:contact|call)\s+us\s+(?:for|at)\b/i,
    /\b(?:we\s+)?reserve\s+the\s+right\s+to\b/i,
    /\b(?:please\s+)?(?:see|ask)\s+(?:our\s+)?(?:staff|server)\b/i,
  ];
  if (instructionPatterns.some((re) => re.test(nameLower) || re.test(combined))) return true;

  return false;
}

/** 尝试从解析对象中提取菜品数组 */
function tryParseToDishes(parsed, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed?.dishes ?? parsed?.items ?? parsed?.dish ?? parsed?.菜品 ?? []);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let dishes = arr.map((item) => formatDish(item, defaultCurrency)).filter((d) => (d.originalName || d.briefCN) && !isLikelyNonDish(d.originalName, d.briefCN));
  if (dishes.length === 0) return null;
  if (parsed && Array.isArray(parsed.prices)) {
    dishes = applyPricesByIndex(dishes, parsed.prices, defaultCurrency);
  }
  return dishes;
}

/** 修复常见 JSON 格式问题（尾逗号） */
function sanitizeJsonStr(s) {
  return s.replace(/,(\s*[}\]])/g, "$1");
}

/** 解析 AI 返回的 JSON，提取 isMenu；若 isMenu 为 false 表示非菜单内容 */
function parseAiResponseMeta(text) {
  if (!text || typeof text !== "string") return { isMenu: true };
  let jsonStr = String(text).trim().replace(/^\uFEFF/, "");
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const jsonStart = jsonStr.search(/\{\s*["']?(?:dishes|isMenu)["']?\s*[:[]/);
  if (jsonStart > 0) jsonStr = jsonStr.slice(jsonStart);
  try {
    const parsed = JSON.parse(sanitizeJsonStr(jsonStr));
    const isMenu = parsed && parsed.isMenu !== false;
    return { isMenu, parsed };
  } catch (_) {
    return { isMenu: true };
  }
}

/** 从 AI 返回文本中提取 JSON 数组（支持截断修复） */
function parseDishesFromText(text, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  let jsonStr = String(text || "").trim().replace(/^\uFEFF/, "");
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const jsonStart = jsonStr.search(/\{\s*["']?(?:dishes|items|Dishes|Items)["']?\s*:\s*\[/i);
  if (jsonStart > 0) jsonStr = jsonStr.slice(jsonStart);
  try {
    const parsed = JSON.parse(jsonStr);
    const dishes = tryParseToDishes(parsed, defaultCurrency);
    if (dishes) return dishes;
  } catch (e) {}
  try {
    const fixed = sanitizeJsonStr(jsonStr);
    const parsed = JSON.parse(fixed);
    const dishes = tryParseToDishes(parsed, defaultCurrency);
    if (dishes) return dishes;
  } catch (e) {}
  const objMatch = jsonStr.match(/\{\s*["']?(?:dishes|items)["']?\s*:\s*\[[\s\S]*\]\s*\}/i);
  const arrMatch = objMatch || jsonStr.match(/\[[\s\S]*\]/) || jsonStr.match(/\[[\s\S]*/);
  if (arrMatch) jsonStr = arrMatch[0];

  try {
    const parsed = JSON.parse(jsonStr);
    const dishes = tryParseToDishes(parsed, defaultCurrency);
    if (dishes) return dishes;
  } catch (e) {}
  try {
    const parsed = JSON.parse(sanitizeJsonStr(jsonStr));
    const dishes = tryParseToDishes(parsed, defaultCurrency);
    if (dishes) return dishes;
  } catch (e) {}

  let lastCompleteIndex = -1;
  let braceDepth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braceDepth++;
    if (ch === "}") {
      braceDepth--;
      if (braceDepth === 0) lastCompleteIndex = i;
    }
  }

  if (lastCompleteIndex > 0) {
    const truncated = jsonStr.substring(0, lastCompleteIndex + 1) + "]";
    const fixedStr = truncated.startsWith("[") ? truncated : "[" + truncated;
    try {
      const arr = JSON.parse(fixedStr);
      if (Array.isArray(arr) && arr.length > 0) {
        const dishes = arr.map((item) => formatDish(item, defaultCurrency)).filter((d) => (d.originalName || d.briefCN) && !isLikelyNonDish(d.originalName, d.briefCN));
        dishes.push({
          originalName: "⚠️ 菜单较长",
          briefCN: "建议分页拍摄查看更多",
          detail: {
            description: "当前菜单内容较多，AI未能完整识别所有菜品。建议将菜单分成多页拍摄，每次拍摄1-2页效果最佳。",
            introduction: "当前菜单内容较多，AI未能完整识别所有菜品。建议将菜单分成多页拍摄，每次拍摄1-2页效果最佳。",
            ingredients: [],
            flavor: "",
            price: "",
            options: [],
            dietaryTags: [],
          },
        });
        return dishes;
      }
    } catch (e2) {}
  }

  throw new Error("无法解析AI返回的菜品数据");
}

/** 回退解析：仅提取 originalName + briefCN，detail 为空 */
function parseDishesMinimal(text, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  let jsonStr = String(text || "").trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const objMatch = jsonStr.match(/\{\s*["']?(?:dishes|items)["']?\s*:\s*\[[\s\S]*\]\s*\}/i);
  const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (objMatch) jsonStr = objMatch[0];
  else if (arrMatch) jsonStr = arrMatch[0];
  jsonStr = sanitizeJsonStr(jsonStr);

  try {
    const parsed = JSON.parse(jsonStr);
    const arr = Array.isArray(parsed) ? parsed : (parsed?.dishes ?? parsed?.items ?? []);
    if (!Array.isArray(arr)) return [];
    let dishes = arr
      .map((item) => {
        const d = item?.detail ?? item?.details ?? {};
        const bg = String(
          item?.background ?? item?.story ?? d?.background ?? d?.story ?? ""
        ).trim();
        const desc = String(
          item?.description ?? d?.description ?? ""
        ).trim();
        const mergedIntro = [bg, desc].filter(Boolean).join("\n").trim() || "";
        return {
          originalName: String(item?.originalName ?? item?.name ?? "").trim(),
          briefCN: String(item?.briefCN ?? item?.brief ?? "").trim(),
          detail: {
            description: mergedIntro,
            introduction: mergedIntro,
            ingredients: normalizeIngredients(
              item?.ingredients ?? (item?.detail ?? item?.details ?? {})?.ingredients
            ),
            flavor: String(item?.flavor ?? (item?.detail ?? item?.details ?? {})?.flavor ?? "").trim(),
            price: normalizePrice(
              item?.price ??
                item?.priceText ??
                item?.cost ??
                item?.amount ??
                item?.价格 ??
                (item?.detail ?? item?.details ?? {})?.price ??
                (item?.detail ?? item?.details ?? {})?.priceText ??
                (item?.detail ?? item?.details ?? {})?.cost ??
                (item?.detail ?? item?.details ?? {})?.amount ??
                (item?.detail ?? item?.details ?? {})?.价格,
              defaultCurrency
            ),
            options: normalizeOptionGroups(
              item?.options ??
                item?.optionGroups ??
                item?.addons ??
                (item?.detail ?? item?.details ?? {})?.options ??
                (item?.detail ?? item?.details ?? {})?.optionGroups
            ),
            dietaryTags: normalizeDietaryTags(
              item?.dietaryTags ??
                item?.tags ??
                item?.labels ??
                (item?.detail ?? item?.details ?? {})?.dietaryTags ??
                (item?.detail ?? item?.details ?? {})?.tags
            ),
            recommendation: String(
              item?.recommendation ??
                item?.suggestion ??
                (item?.detail ?? item?.details ?? {})?.recommendation ??
                (item?.detail ?? item?.details ?? {})?.suggestion
            ).trim(),
          },
        };
      })
      .filter((d) => (d.originalName || d.briefCN) && !isLikelyNonDish(d.originalName, d.briefCN));
    if (parsed && Array.isArray(parsed.prices)) {
      dishes = applyPricesByIndex(dishes, parsed.prices, defaultCurrency);
    }
    return dishes;
  } catch {
    return [];
  }
}

/** 从文本窗口提取 JSON 字段值（用于流式兜底解析） */
function extractFieldFromWindow(window, fieldName) {
  const re = new RegExp(
    `["']${fieldName}["']\\s*:\\s*["']((?:[^"\\\\]|\\\\.)*)["']`,
    "i"
  );
  const match = window.match(re);
  return match ? match[1].replace(/\\"/g, '"').trim() : "";
}

/** 从文本窗口提取 ingredients 数组 */
function extractIngredientsFromWindow(window) {
  const arrMatch = window.match(/"ingredients"\s*:\s*\[([^\]]*)\]/i);
  if (!arrMatch) return [];
  const inner = arrMatch[1];
  const parts = inner.match(/"([^"]*)"/g);
  if (!parts) return [];
  return parts
    .map((p) => p.slice(1, -1).trim())
    .filter((s) => s && !isPlaceholderIngredient(s))
    .slice(0, 6);
}

/** 兜底：用正则提取菜品，并尽可能提取 description、flavor、recommendation、ingredients */
function parseDishesFallback(text) {
  const dishes = [];
  const regex = /\{\s*["']?(?:originalName|name)["']?\s*:\s*["']([^"']*)["']\s*,\s*["']?(?:briefCN|brief)["']?\s*:\s*["']([^"']*)["']/g;
  let m;
  const matches = [];
  while ((m = regex.exec(text)) !== null) {
    matches.push({ index: m.index, originalName: (m[1] || "").trim(), briefCN: (m[2] || "").trim() });
  }
  for (let i = 0; i < matches.length; i++) {
    const { originalName, briefCN, index } = matches[i];
    if (!originalName && !briefCN) continue;
    if (isLikelyNonDish(originalName, briefCN)) continue;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const window = text.slice(index, Math.min(index + 900, end));
    const description = extractFieldFromWindow(window, "description");
    const flavor = extractFieldFromWindow(window, "flavor");
    const recommendation = extractFieldFromWindow(window, "recommendation");
    const ingredients = extractIngredientsFromWindow(window);
    const intro = description || "";
    dishes.push({
      originalName,
      briefCN,
      detail: {
        description: intro,
        introduction: intro,
        ingredients: normalizeIngredients(ingredients),
        flavor,
        price: extractFieldFromWindow(window, "price") || "",
        options: [],
        dietaryTags: [],
        recommendation,
      },
    });
  }
  return dishes;
}

/** 从可能截断的 JSON 字符串中尝试解析出已完整的菜品数组（用于流式推送 partialDishes） */
function tryParsePartialDishes(acc, defaultCurrency) {
  if (defaultCurrency === undefined) defaultCurrency = "";
  const s = String(acc).trim();
  const start = s.search(/\{\s*["']?(?:dishes|items)["']?\s*:\s*\[/i);
  if (start < 0) return null;
  let jsonStr = s.slice(start);
  for (const suffix of ["}]}", "]}", "]"]) {
    try {
      const parsed = JSON.parse(jsonStr + suffix);
      const arr = parsed?.dishes ?? parsed?.items ?? (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(arr) && arr.length > 0) {
        const dishes = arr.map((item) => formatDish(item, defaultCurrency)).filter((d) => (d.originalName || d.briefCN) && !isLikelyNonDish(d.originalName, d.briefCN));
        if (dishes.length > 0) return dishes;
      }
    } catch (_) {}
  }
  return null;
}

/** 从 AI 返回文本中提取 recommendations 数组 */
function parseRecommendationsFromText(text) {
  if (!text || typeof text !== "string") return [];
  let jsonStr = String(text).trim().replace(/^\uFEFF/, "");
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const jsonStart = jsonStr.search(/\{\s*["']?(?:dishes|isMenu|recommendations)["']?\s*[:[]/);
  if (jsonStart > 0) jsonStr = jsonStr.slice(jsonStart);
  try {
    const parsed = JSON.parse(sanitizeJsonStr(jsonStr));
    const recs = parsed?.recommendations;
    if (!Array.isArray(recs) || recs.length === 0) return [];
    return recs
      .filter(r => r && typeof r === "object")
      .map(r => ({
        dishIndex: typeof r.dishIndex === "number" ? r.dishIndex : -1,
        dishName: String(r.dishName ?? "").trim(),
        reason: String(r.reason ?? "").trim(),
      }))
      .filter(r => r.dishName || r.dishIndex >= 0)
      .slice(0, 5);
  } catch (_) {
    return [];
  }
}

module.exports = {
  isPlaceholderIngredient,
  normalizeIngredients,
  normalizePrice,
  detectCurrencyFromOcrText,
  extractPricesFromOcrText,
  normalizeOptionRule,
  normalizeOptionGroups,
  normalizeDietaryTags,
  sanitizeChineseText,
  formatDish,
  applyPricesByIndex,
  tryParseToDishes,
  sanitizeJsonStr,
  parseAiResponseMeta,
  parseDishesFromText,
  parseDishesMinimal,
  parseDishesFallback,
  isLikelyNonDish,
  tryParsePartialDishes,
  parseRecommendationsFromText,
};
