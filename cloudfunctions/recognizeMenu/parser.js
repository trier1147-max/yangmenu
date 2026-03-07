// 洋菜单 - 菜品解析模块，纯逻辑无外部依赖，便于单元测试
// 常见食材英文→中文映射，用于兜底确保中国用户不看到英文
const INGREDIENT_ZH_MAP = {
  lettuce: "生菜", salad: "沙拉", tomato: "番茄", tomatoes: "番茄",
  beef: "牛肉", chicken: "鸡肉", fish: "鱼", pork: "猪肉", lamb: "羊肉", duck: "鸭肉",
  cheese: "芝士", bacon: "培根", onion: "洋葱", onions: "洋葱",
  garlic: "大蒜", "olive oil": "橄榄油", basil: "罗勒", pepper: "胡椒", salt: "盐",
  pasta: "意面", rice: "米饭", bread: "面包", egg: "鸡蛋", eggs: "鸡蛋",
  milk: "牛奶", cream: "奶油", butter: "黄油", mushroom: "蘑菇", mushrooms: "蘑菇",
  shrimp: "虾", salmon: "三文鱼", cod: "鳕鱼", tuna: "金枪鱼", crab: "蟹",
  potato: "土豆", potatoes: "土豆", carrot: "胡萝卜", carrots: "胡萝卜",
  spinach: "菠菜", broccoli: "西兰花", asparagus: "芦笋", avocado: "牛油果",
  lemon: "柠檬", lemons: "柠檬", lime: "青柠", olive: "橄榄", olives: "橄榄",
  parmesan: "帕玛森芝士", mozzarella: "马苏里拉芝士", feta: "羊奶酪",
  cilantro: "香菜", parsley: "欧芹", thyme: "百里香", oregano: "牛至",
  honey: "蜂蜜", vinegar: "醋", "soy sauce": "酱油", mustard: "芥末",
  coconut: "椰子", almond: "杏仁", walnut: "核桃", peanut: "花生",
  "bell pepper": "甜椒", "green pepper": "青椒", chili: "辣椒",
  ginger: "姜", "green onion": "葱", scallion: "葱", "spring onion": "葱",
  noodle: "面条", noodles: "面条", "rice noodle": "米粉",
  tofu: "豆腐", "seaweed": "海苔", nori: "海苔", wasabi: "芥末",
  "sour cream": "酸奶油", yogurt: "酸奶", "maple syrup": "枫糖浆",
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

function normalizePrice(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, "");
  const withCurrency = compact.replace(/^([0-9]+(?:\.[0-9]{1,2})?)$/, "¥$1");
  const normalized = withCurrency
    .replace(/^RMB/i, "¥")
    .replace(/^￥/, "¥");

  if (normalized.length > 20) return "";
  if (!/[0-9]/.test(normalized)) return "";
  return normalized;
}

/** 从 OCR 文本中按出现顺序提取所有类似价格的值 */
function extractPricesFromOcrText(ocrText) {
  if (!ocrText || typeof ocrText !== "string") return [];
  const results = [];
  const regex = /(?:¥|￥|\$|€|£|RMB\s*)?(\d{1,5}(?:\.\d{1,2})?)(?:\s*元)?/g;
  let m;
  while ((m = regex.exec(ocrText)) !== null) {
    const num = parseFloat(m[1]);
    if (Number.isFinite(num) && num >= 0.01 && num <= 99999) {
      results.push(m[0].trim());
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

function formatDish(item) {
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
      detail?.价格
  );
  const options = normalizeOptionGroups(
    item?.options ?? item?.optionGroups ?? item?.addons ?? detail?.options ?? detail?.optionGroups
  );
  const dietaryTags = normalizeDietaryTags(
    item?.dietaryTags ?? item?.tags ?? item?.labels ?? detail?.dietaryTags ?? detail?.tags
  );

  return {
    originalName: String(item?.originalName ?? item?.name ?? "").trim(),
    briefCN: String(item?.briefCN ?? item?.brief ?? "").trim(),
    detail: {
      description: mergedIntro,
      introduction: mergedIntro,
      ingredients: normalizeIngredients(item?.ingredients ?? detail?.ingredients),
      flavor: String(item?.flavor ?? detail?.flavor ?? detail?.风味 ?? "").trim(),
      price,
      options,
      dietaryTags,
      recommendation,
    },
  };
}

/** 若解析结果有顶层 prices 数组，按索引为缺失 price 的菜品补全 */
function applyPricesByIndex(dishes, pricesArray) {
  if (!Array.isArray(dishes) || !Array.isArray(pricesArray) || pricesArray.length === 0)
    return dishes;
  return dishes.map((d, i) => {
    const existing = String((d.detail && d.detail.price) || "").trim();
    if (existing) return d;
    const p = normalizePrice(pricesArray[i]);
    if (!p) return d;
    return {
      ...d,
      detail: d.detail ? { ...d.detail, price: p } : { description: "", introduction: "", ingredients: [], flavor: "", price: p, options: [] },
    };
  });
}

/** 尝试从解析对象中提取菜品数组 */
function tryParseToDishes(parsed) {
  const arr = Array.isArray(parsed)
    ? parsed
    : (parsed?.dishes ?? parsed?.items ?? parsed?.dish ?? parsed?.菜品 ?? []);
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let dishes = arr.map(formatDish).filter((d) => d.originalName || d.briefCN);
  if (dishes.length === 0) return null;
  if (parsed && Array.isArray(parsed.prices)) {
    dishes = applyPricesByIndex(dishes, parsed.prices);
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
function parseDishesFromText(text) {
  let jsonStr = String(text || "").trim().replace(/^\uFEFF/, "");
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const jsonStart = jsonStr.search(/\{\s*["']?(?:dishes|items|Dishes|Items)["']?\s*:\s*\[/i);
  if (jsonStart > 0) jsonStr = jsonStr.slice(jsonStart);
  try {
    const parsed = JSON.parse(jsonStr);
    const dishes = tryParseToDishes(parsed);
    if (dishes) return dishes;
  } catch (e) {}
  try {
    const fixed = sanitizeJsonStr(jsonStr);
    const parsed = JSON.parse(fixed);
    const dishes = tryParseToDishes(parsed);
    if (dishes) return dishes;
  } catch (e) {}
  const objMatch = jsonStr.match(/\{\s*["']?(?:dishes|items)["']?\s*:\s*\[[\s\S]*\]\s*\}/i);
  const arrMatch = objMatch || jsonStr.match(/\[[\s\S]*\]/) || jsonStr.match(/\[[\s\S]*/);
  if (arrMatch) jsonStr = arrMatch[0];

  try {
    const parsed = JSON.parse(jsonStr);
    const dishes = tryParseToDishes(parsed);
    if (dishes) return dishes;
  } catch (e) {}
  try {
    const parsed = JSON.parse(sanitizeJsonStr(jsonStr));
    const dishes = tryParseToDishes(parsed);
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
        const dishes = arr.map(formatDish).filter((d) => d.originalName || d.briefCN);
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
function parseDishesMinimal(text) {
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
                (item?.detail ?? item?.details ?? {})?.价格
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
      .filter((d) => d.originalName || d.briefCN);
    if (parsed && Array.isArray(parsed.prices)) {
      dishes = applyPricesByIndex(dishes, parsed.prices);
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
function tryParsePartialDishes(acc) {
  const s = String(acc).trim();
  const start = s.search(/\{\s*["']?(?:dishes|items)["']?\s*:\s*\[/i);
  if (start < 0) return null;
  let jsonStr = s.slice(start);
  for (const suffix of ["}]}", "]}", "]"]) {
    try {
      const parsed = JSON.parse(jsonStr + suffix);
      const arr = parsed?.dishes ?? parsed?.items ?? (Array.isArray(parsed) ? parsed : null);
      if (Array.isArray(arr) && arr.length > 0) {
        const dishes = arr.map(formatDish).filter((d) => d.originalName || d.briefCN);
        if (dishes.length > 0) return dishes;
      }
    } catch (_) {}
  }
  return null;
}

module.exports = {
  isPlaceholderIngredient,
  normalizeIngredients,
  normalizePrice,
  extractPricesFromOcrText,
  normalizeOptionRule,
  normalizeOptionGroups,
  normalizeDietaryTags,
  formatDish,
  applyPricesByIndex,
  tryParseToDishes,
  sanitizeJsonStr,
  parseAiResponseMeta,
  parseDishesFromText,
  parseDishesMinimal,
  parseDishesFallback,
  tryParsePartialDishes,
};
