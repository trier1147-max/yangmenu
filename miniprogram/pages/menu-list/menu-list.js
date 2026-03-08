"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const history_1 = require("../../services/history");
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
    tofu: "豆腐", seaweed: "海苔", nori: "海苔", wasabi: "芥末",
    "sour cream": "酸奶油", yogurt: "酸奶", "maple syrup": "枫糖浆",
};
function translateIngredientToZh(value) {
    const raw = value.trim();
    if (!raw)
        return "";
    const lower = raw.toLowerCase();
    if (INGREDIENT_ZH_MAP[lower])
        return INGREDIENT_ZH_MAP[lower];
    if (/[\u4e00-\u9fff]/.test(raw))
        return raw;
    return "";
}
function isPlaceholderIngredient(value) {
    const raw = String(value ?? "").trim();
    if (!raw)
        return true;
    const normalized = raw
        .toLowerCase()
        .replace(/[：:()（）\[\]【】]/g, "")
        .replace(/\s+/g, "");
    const genericOnly = /^(食材|原料|配料|材料|主料|辅料|佐料|调料|ingredient|ingredients|material|materials|item|food)$/i;
    return (genericOnly.test(raw) ||
        /^(食材|原料|配料|材料|主料|辅料|佐料|调料)[a-z0-9一二三四五六七八九十甲乙丙丁]?$/.test(raw) ||
        /(食材|原料|配料|材料|ingredient|material)[-_:： ]?[a-z0-9一二三四五六七八九十甲乙丙丁]+$/i.test(raw) ||
        /^(ingredient|ingredients|material|materials)[-_ ]?[a-z0-9]+$/i.test(raw) ||
        /^(item|food)[-_ ]?[a-z0-9]+$/i.test(raw) ||
        /(示例|样例|占位|placeholder|sample|demo|test|mock)/i.test(raw) ||
        /^(a|b|c|d|e|f|g|1|2|3|4|5|6)$/.test(normalized));
}
function normalizeIngredients(list) {
    if (!Array.isArray(list) && typeof list !== "string")
        return [];
    const seen = new Set();
    const result = [];
    const rawList = Array.isArray(list) ? list : [list];
    rawList.forEach((item) => {
        const value = String(item ?? "").trim();
        if (!value)
            return;
        const parts = value
            .split(/[、,，;；/|]/)
            .map((part) => part
            .trim()
            .replace(/^[\-•·\s]+/, "")
            .replace(/^(食材|原料|配料|材料|主料|辅料|佐料|调料)[：:]\s*/i, "")
            .trim())
            .filter(Boolean);
        const candidates = parts.length > 0 ? parts : [value];
        candidates.forEach((candidate) => {
            if (!candidate || isPlaceholderIngredient(candidate))
                return;
            const zh = translateIngredientToZh(candidate) || candidate;
            if (!zh)
                return;
            const key = zh.toLowerCase();
            if (seen.has(key))
                return;
            seen.add(key);
            if (result.length < 6)
                result.push(zh);
        });
    });
    return result;
}
function normalizeImageSource(raw) {
    const src = String(raw ?? "").trim();
    if (!src.startsWith("http"))
        return src;
    const tMatch = src.match(/[?&]t=(\d{10,})/);
    if (!tMatch)
        return src;
    const expiry = Number(tMatch[1]);
    if (!Number.isFinite(expiry))
        return src;
    if (Math.floor(Date.now() / 1000) >= expiry)
        return "";
    return src;
}
function normalizePrice(raw) {
    const value = String(raw ?? "").trim();
    if (!value)
        return "";
    const normalized = value.replace(/^楼/, "").replace(/\s+/g, " ");
    if (!/[0-9]/.test(normalized))
        return "";
    if (normalized.length > 30)
        return normalized.slice(0, 30);
    return normalized;
}
function extractCurrencySymbol(price) {
    const value = String(price || "").trim();
    if (!value)
        return "";
    const symbolMatch = value.match(/^(¥|￥|\$|€|£|₩|₽|₹|฿|₫|₺|₴|₱|CHF|HK\$|MOP\$|NT\$|R\$|A\$|C\$)/i);
    return symbolMatch ? symbolMatch[1] : "";
}
function detectMenuCurrencySymbol(dishes) {
    const counter = {};
    dishes.forEach((dish) => {
        const price = String(dish.detail?.price ?? "").trim();
        const symbol = extractCurrencySymbol(price);
        if (!symbol)
            return;
        counter[symbol] = (counter[symbol] || 0) + 1;
    });
    let best = "";
    let max = 0;
    Object.keys(counter).forEach((key) => {
        if (counter[key] > max) {
            max = counter[key];
            best = key;
        }
    });
    return best;
}
function applyCurrencySymbol(price, menuCurrencySymbol) {
    const value = String(price || "").trim();
    if (!value)
        return "";
    if (!menuCurrencySymbol)
        return value;
    if (extractCurrencySymbol(value))
        return value;
    if (!/^[0-9]+(\.[0-9]+)?$/.test(value))
        return value;
    return `${menuCurrencySymbol}${value}`;
}
function normalizeOptionRule(rule) {
    const value = String(rule ?? "").trim();
    if (!value)
        return "";
    if (value.length > 30)
        return value.slice(0, 30);
    return value;
}
function normalizeOptionGroups(raw) {
    if (!Array.isArray(raw))
        return [];
    const groups = [];
    raw.forEach((item) => {
        const obj = (item ?? {});
        const group = String(obj.group ?? obj.name ?? obj.title ?? "").trim();
        const rule = normalizeOptionRule(obj.rule);
        const source = Array.isArray(obj.choices)
            ? obj.choices
            : Array.isArray(obj.items)
                ? obj.items
                : Array.isArray(obj.options)
                    ? obj.options
                    : [];
        const seen = new Set();
        const choices = [];
        source.forEach((entry) => {
            const text = typeof entry === "string"
                ? entry.trim()
                : String(entry?.name ??
                    entry?.label ??
                    entry?.value ??
                    "").trim();
            if (!text || seen.has(text))
                return;
            seen.add(text);
            if (choices.length < 12)
                choices.push(text);
        });
        if (!group && !rule && choices.length === 0)
            return;
        if (groups.length < 6)
            groups.push({ group, rule, choices });
    });
    return groups;
}
function inferDishCategory(dish) {
    // 只用菜名和 briefCN 做分类，不用描述/食材——避免"含面包的拼盘"被误归为面包类
    const nameText = [
        String(dish.originalName || ""),
        String(dish.briefCN || ""),
    ].join(" ").toLowerCase();
    // 顺序重要：拼盘/组合最优先；具体形式（汤/面/饭）优先于食材（鸡/猪/羊）
    const rules = [
        // ── 组合类（必须最先，防止被食材类误判）
        { label: "拼盘", patterns: [/platter|board|sharing|assorted|tasting|combination|selection|mixed|charcuterie.?board|antipasto|拼盘|拼板|拼碟|什锦|拼|组合|精选拼|分享盘/] },
        // ── 饮品（在鸡/茶等单字前先排除）
        { label: "饮品", patterns: [/\bcocktail|mocktail|mojito|margarita|martini|negroni|aperol|spritz|\bwine\b|\bbeer\b|\bcoffee\b|\btea\b|\bjuice\b|\blatte\b|\bespresso\b|\bcappuccino\b|\bamericano\b|\bsmoothie\b|\bsangria\b|\bgin\b|\bvodka\b|\brum\b|\bwhisky|\bwhiskey|\bliqueur\b|\bmilkshake\b|\blemonade\b|\bboba\b|鸡尾酒|无酒精饮|饮品|咖啡|奶茶|果茶|花茶|果汁|苏打水|汽水|拿铁|美式咖啡|卡布奇诺|奶昔|柠檬水|果昔|气泡水|冷萃/] },
        // ── 汤品
        { label: "汤品", patterns: [/\bsoup\b|\bbisque\b|\bchowder\b|\bgazpacho\b|\bvichyssoise\b|\bminestrone\b|\bbouillabaisse\b|\bbouillon\b|\bconsommé\b|汤$|^汤|浓汤|汤品|例汤|冷汤|炖汤|奶油汤|罗宋汤|法式洋葱汤|蛤蜊浓汤/] },
        // ── 沙拉
        { label: "沙拉", patterns: [/\bsalad\b|沙拉|凯撒|尼斯沙拉|华尔道夫/] },
        // ── 意面
        { label: "意面", patterns: [/\bpasta\b|\bspaghetti\b|\blinguine\b|\bfettuccine\b|\bpenne\b|\brigatoni\b|\btagliatelle\b|\blasagna\b|\bravioli\b|\btortellini\b|\bgnocchi\b|\borzo\b|意面|意粉|通心粉|意式饺子|宽面|扁面条/] },
        // ── 米饭类
        { label: "烩饭", patterns: [/\brisotto\b|\bpaella\b|\bpilaf\b|\bfried.?rice\b|烩饭|海鲜饭|炒饭|炖饭|焗饭|盖饭|饭|丼/] },
        // ── 披萨
        { label: "披萨", patterns: [/\bpizza\b|\bflatbread.{0,8}(pizza|topped)|披萨|比萨|薄饼披萨/] },
        // ── 汉堡
        { label: "汉堡", patterns: [/\bburger\b|\bhamburger\b|\bsmash.?burger\b|汉堡|汉堡包|芝士堡|牛肉堡|鸡堡|鱼堡|虾堡/] },
        // ── 三明治
        { label: "三明治", patterns: [/\bsandwich\b|\bsub\b|\bpanini\b|\bclub\b|\bhero\b|\bhoagie\b|三明治|三文治|潜艇堡|帕尼尼/] },
        // ── 炸物（先于鸡肉/猪肉）
        { label: "炸物", patterns: [/\bfried\b|\bdeep.?fry|\bfritter\b|\bschnitzel\b|\btempura\b|\bcalamari\b|\bchips\b|\bfries\b|\bnugget|\bwing|\btender|\bstrip\b|炸鸡|炸薯条|炸鱿鱼|炸虾|鸡翅|鸡米花|薯条|薯格|炸猪排|炸鱼|裹粉炸/] },
        // ── 烤物·扒类（先于食材类）
        { label: "烤物", patterns: [/\bgrilled?\b|\broasted?\b|\bbbq\b|\bbarbecue\b|\brotisserie\b|\bchargrilled\b|烤鸡|烤鱼|烤肉|烤羊|烤鸭|烤蔬|烧烤|炙烤|扒|焗烤|明火|炭烤/] },
        // ── 牛排（先于牛肉）
        { label: "牛排", patterns: [/\bsteak\b|\bsirloin\b|\bribeye\b|\btenderloin\b|\bt.?bone\b|\bentrecôte\b|\bnew.?york.?strip\b|牛排|菲力|西冷|肋眼|牛扒|霜降牛/] },
        // ── 炖菜·慢煮
        { label: "炖菜", patterns: [/\bstew\b|\bragu\b|\bconfit\b|\bcassoulet\b|\bossobuco\b|\bratatouille\b|\bbraised?\b|\bslow.?cook|\bcacciatore\b|炖|烩菜|勃艮第|油封|普罗旺斯炖|红酒炖|砂锅|慢煮/] },
        // ── 寿司·日料
        { label: "寿司", patterns: [/\bsushi\b|\bsashimi\b|\bnigiri\b|\bmaki\b|\btemaki\b|\bomakase\b|\buramaki\b|寿司|刺身|手卷|卷物|鱼生|握寿司|军舰卷/] },
        // ── 煎饼·华夫
        { label: "煎饼", patterns: [/\bcrepe\b|\bcrêpe\b|\bpancake\b|\bwaffle\b|\bdutch.?baby\b|煎饼|可丽饼|华夫|班戟|薄饼/] },
        // ── 派·挞
        { label: "派", patterns: [/\bpie\b|\bquiche\b|\btart\b|\bwellington\b|派|法式咸派|酥皮|挞|千层酥|惠灵顿/] },
        // ── 冷盘·熟食
        { label: "冷盘", patterns: [/\bcharcuterie\b|\bprosciutto\b|\bjamón\b|\bgravlax\b|\bantipasto\b|\bbresaola\b|\bcarpaccio\b|冷盘|冷切|腌肉|帕尔马火腿|伊比利亚|烟熏三文鱼|生牛肉片|熟食/] },
        // ── 面包·烘焙
        { label: "面包", patterns: [/\bbread\b(?!.{0,10}(sandwich|crumb|basket|bowl))|\bcroissant\b|\bpretzel\b|\bfocaccia\b|\bciabatta\b|\bsourdough\b|\bbrioche\b|\bbagel\b|\bnaan\b|\bpita\b|面包|可颂|碱水结|佛卡夏|恰巴塔|酸面包|贝果|皮塔饼/] },
        // ── 海鲜
        { label: "海鲜", patterns: [/\bseafood\b|\blobster\b|\boyster\b|\bcrab\b|\bprawn\b|\bscallop\b|\bclam\b|\bmussel\b|\boctopus\b|\bsquid\b|\bhalibut\b|\bsea.?bass\b|\bdorade\b|\btuna\b|\bcod\b|海鲜|龙虾|生蚝|蟹|扇贝|蛤蜊|青口|章鱼|鱿鱼|鳕鱼|比目鱼|鲈鱼|鱼排|鱼扒/] },
        // ── 咖喱
        { label: "咖喱", patterns: [/\bcurry\b|\btikka\b|\bmasala\b|\bvindaloo\b|\bkorma\b|\bdal\b|\bbiryani\b|咖喱|日式咖喱|泰式咖喱|印度咖喱|黄咖喱|绿咖喱|红咖喱/] },
        // ── 墨西哥
        { label: "墨西哥", patterns: [/\btaco\b|\bburrito\b|\bfajita\b|\bquesadilla\b|\benchilada\b|\bnachos\b|\bguacamole\b|\bchimichanga\b|塔可|卷饼|墨西哥|玉米饼|纳乔斯/] },
        // ── 食材类（靠后，只在菜名明确标注时才用）
        { label: "牛肉", patterns: [/\bbeef\b|\bwagyu\b|\bshort.?rib\b|\bveal\b|牛肉|牛腩|牛尾|炖牛|和牛/] },
        { label: "鸡肉", patterns: [/\bchicken\b|\bpollo\b|\bpoussin\b|鸡肉|鸡腿|鸡胸|鸡块|鸡扒|嫩鸡|整鸡/] },
        { label: "猪肉", patterns: [/\bpork\b|\bpig\b|\bpiglet\b|\bwurst\b|\bporchetta\b|\biberico\b|猪排|猪肘|猪肉|猪脸|烤乳猪|猪小排/] },
        { label: "羊肉", patterns: [/\blamb\b|\bmutton\b|\bagneau\b|羊排|羊肉|羊腿|羊架/] },
        { label: "素食", patterns: [/\bvegan\b|\bvegetarian\b|\bveggie\b|\bplant.?based\b|素食|纯素|蔬食|全素/] },
        // ── 甜点
        { label: "甜点", patterns: [/\bdessert\b|\bcake\b|\bpudding\b|\bice.?cream\b|\btiramisu\b|\bmacaron\b|\bchurros\b|\bsoufflé\b|\btrifle\b|\bmousse\b|\bpanna.?cotta\b|\bfondant\b|\bbrownie\b|\bmille.?feuille\b|\bcrème.?brûlée\b|\bprofiterole\b|\bgelato\b|\bsorbet\b|\bcheesecake\b|\bparfait\b|甜点|蛋糕|布丁|提拉米苏|冰淇淋|雪糕|马卡龙|蛋挞|舒芙蕾|慕斯|奶冻|焦糖布丁|泡芙|千层酥|巧克力熔岩/] },
        // ── 开胃小食
        { label: "小食", patterns: [/\bappetizer\b|\bstarter\b|\btapas\b|\bbruschetta\b|\bamuse.?bouche\b|\bfingers\b|\bsnack\b|小食|开胃菜|小菜|前菜/] },
    ];
    for (const rule of rules) {
        if (rule.patterns.some((pattern) => pattern.test(nameText)))
            return rule.label;
    }
    return "其他";
}
Page({
    data: {
        recordId: "",
        fromHistory: false,
        imageFileID: "",
        allDishes: [],
        dishes: [],
        categories: [],
        collapsedCategories: [],
        activeCategory: "all",
        categoryExpanded: false,
        orderDishCount: 0,
        orderItemCount: 0,
        orderAmountText: "",
        orderSummaryText: "",
        orderListItems: [],
        showOrderBar: false,
        orderDetailVisible: false,
        scrollIntoId: "",
        initialLoading: true,
        processing: false,
        timeoutHint: "",
        menuTooLongHint: "",
        error: "",
        recommendations: [],
    },
    _processingTimer: 0,
    _pollTimer: 0,
    _expandedKeys: new Set(),
    _orderMap: new Map(),
    /** 原始 detail，用于首次展开时延迟计算 ingredients/options */
    _rawDetailMap: new Map(),
    async onLoad(options) {
        const recordId = options?.recordId ?? "";
        const fromHistory = options?.from === "history";
        this.setData({
            recordId,
            fromHistory,
            initialLoading: true,
            processing: false,
            timeoutHint: "",
            menuTooLongHint: "",
            error: "",
            activeCategory: "all",
            recommendations: [],
        });
        if (!recordId) {
            this.setData({ initialLoading: false, error: "缺少记录 ID" });
            return;
        }
        this._processingTimer = setTimeout(() => {
            if (this.data.processing) {
                this.setData({ timeoutHint: "识别时间较长，可能网络或服务繁忙，可返回重试" });
            }
        }, 30000);
        try {
            const app = getApp();
            const pending = app.globalData?.pendingRecord;
            let record = null;
            if (pending && String(pending._id) === String(recordId)) {
                app.globalData.pendingRecord = null;
                record = pending;
            }
            else if (pending) {
                app.globalData.pendingRecord = null;
            }
            if (!record) {
                record = await (0, history_1.getRecordById)(recordId);
            }
            if (!record) {
                this.setData({ initialLoading: false, error: "未找到记录" });
                return;
            }
            this.applyRecord(record);
            if (record.status === "processing") {
                this.startPolling(recordId);
            }
        }
        catch {
            this.setData({ initialLoading: false, error: "加载失败，请重试" });
        }
    },
    applyRecord(record) {
        const list = (record.partialDishes?.length ? record.partialDishes : record.dishes) ?? [];
        const menuCurrencySymbol = detectMenuCurrencySymbol(list);
        const dishes = list.map((d, index) => {
            const key = this.getDishIdentity(d, index);
            const normalizedDescription = String(d.detail?.description || "").toLowerCase() === "manual input"
                ? ""
                : d.detail?.description || "";
            const introduction = d.detail?.introduction?.trim() ||
                normalizedDescription;
            // 首屏只算必要字段，ingredients/options 延迟到首次展开时计算；已展开的需立即算全
            const needFullDetail = this._expandedKeys.has(key);
            const detail = d.detail
                ? {
                    description: normalizedDescription,
                    introduction,
                    ingredients: needFullDetail ? normalizeIngredients(d.detail?.ingredients) : [],
                    flavor: d.detail?.flavor || "",
                    price: applyCurrencySymbol(normalizePrice(d.detail?.price), menuCurrencySymbol),
                    options: needFullDetail ? normalizeOptionGroups(d.detail?.options) : [],
                    recommendation: d.detail?.recommendation || "",
                }
                : {
                    description: "",
                    introduction: "",
                    ingredients: [],
                    flavor: "",
                    price: "",
                    options: [],
                    recommendation: "",
                };
            if (d.detail && !needFullDetail) {
                this._rawDetailMap.set(key, d.detail);
            }
            const orderCount = this._orderMap.get(key) || 0;
            return Object.assign({}, d, {
                key,
                category: inferDishCategory(d),
                orderCount,
                detail,
                expanded: this._expandedKeys.has(key),
            });
        });
        const processing = record.status === "processing";
        const error = record.status === "error" ? record.errorMessage || "识别失败" : "";
        const menuTooLongHint = record.menuTooLongHint || "";
        const recommendations = processing ? [] : (record.recommendations || []);
        const hasProgress = dishes.length > 0;
        const clearHint = !processing || hasProgress;
        const categories = this.buildCategories(dishes);
        const activeCategory = categories.some((c) => c.key === this.data.activeCategory)
            ? this.data.activeCategory
            : "all";
        const collapsedCategories = categories.slice(0, 4);
        const filteredDishes = this.filterDishesByCategory(dishes, activeCategory);
        const summary = this.computeOrderSummaryPayload(dishes);
        this.setData({
            imageFileID: normalizeImageSource(record.imageFileID),
            allDishes: dishes,
            dishes: filteredDishes,
            categories,
            collapsedCategories,
            activeCategory,
            initialLoading: false,
            processing,
            timeoutHint: clearHint ? "" : this.data.timeoutHint,
            menuTooLongHint,
            error,
            orderDishCount: summary.orderDishCount,
            orderItemCount: summary.orderItemCount,
            orderAmountText: summary.orderAmountText,
            orderSummaryText: summary.orderSummaryText,
            orderListItems: summary.orderListItems,
            showOrderBar: summary.orderItemCount >= 1,
            recommendations,
        });
        if (record.status === "done" || record.status === "error") {
            this.stopPolling();
        }
    },
    /** 使用稳定的 key（不含 price），避免流式更新时 price 变化导致展开状态丢失 */
    getDishIdentity(dish, index) {
        const name = String(dish.originalName ?? "").trim();
        const brief = String(dish.briefCN ?? "").trim();
        return `${name}__${brief}__${index}`;
    },
    /** 首次展开时计算 ingredients/options，减少首屏 setData 体积 */
    ensureDetailForExpand(dish) {
        const key = dish.key || this.getDishIdentity(dish, 0);
        const raw = this._rawDetailMap.get(key);
        if (!raw || (dish.detail?.ingredients?.length ?? 0) > 0)
            return dish;
        const ingredients = normalizeIngredients(raw.ingredients);
        const options = normalizeOptionGroups(raw.options);
        this._rawDetailMap.delete(key);
        return {
            ...dish,
            detail: { ...dish.detail, ingredients, options },
        };
    },
    buildCategories(dishes) {
        const counter = {};
        dishes.forEach((dish) => {
            const label = dish.category || "其他";
            counter[label] = (counter[label] || 0) + 1;
        });
        const categories = Object.keys(counter)
            .sort((a, b) => counter[b] - counter[a])
            .map((label) => ({ key: label, label, count: counter[label] }));
        categories.unshift({ key: "all", label: "全部", count: dishes.length });
        return categories;
    },
    filterDishesByCategory(dishes, categoryKey) {
        if (categoryKey === "all")
            return dishes;
        return dishes.filter((dish) => dish.category === categoryKey);
    },
    refreshVisibleDishes() {
        const visible = this.filterDishesByCategory(this.data.allDishes, this.data.activeCategory);
        this.setData({ dishes: visible });
    },
    parsePriceNumber(price) {
        const value = String(price || "").trim();
        if (!value)
            return NaN;
        const matched = value.match(/-?\d+(?:\.\d+)?/);
        if (!matched)
            return NaN;
        return Number(matched[0]);
    },
    updateOrderSummary(sourceDishes) {
        const list = sourceDishes ?? this.data.allDishes;
        const selected = list.filter((dish) => (dish.orderCount || 0) > 0);
        const orderDishCount = selected.length;
        const orderItemCount = selected.reduce((sum, dish) => sum + (dish.orderCount || 0), 0);
        let amount = 0;
        let pricedItemCount = 0;
        const lines = [];
        selected.forEach((dish) => {
            const count = dish.orderCount || 0;
            const name = dish.originalName || dish.briefCN || "未命名菜品";
            lines.push(`${name} x${count}`);
            const priceText = String(dish.detail?.price || "");
            const priceNumber = this.parsePriceNumber(priceText);
            if (Number.isFinite(priceNumber)) {
                amount += priceNumber * count;
                pricedItemCount += count;
            }
        });
        const amountBaseSymbol = detectMenuCurrencySymbol(selected);
        const orderAmountText = pricedItemCount > 0 ? `${amountBaseSymbol || "¥"}${amount.toFixed(2)}` : "待定";
        const orderSummaryText = lines.length > 0 ? lines.join("\n") : "";
        const baseList = sourceDishes ?? this.data.allDishes;
        const orderListItems = selected.map((dish) => {
            const key = dish.key || this.getDishIdentity(dish, 0);
            const idx = baseList.findIndex((d) => (d.key || "") === key);
            return {
                key,
                name: dish.originalName || dish.briefCN || "未命名菜品",
                price: String(dish.detail?.price || "").trim() || "—",
                count: dish.orderCount || 0,
                scrollIndex: idx >= 0 ? idx : 0,
            };
        });
        this.setData({
            orderDishCount,
            orderItemCount,
            orderAmountText,
            orderSummaryText,
            orderListItems,
        });
    },
    /** 基于给定列表计算点单汇总并返回供一次 setData 使用（避免异步导致首次加菜不显示栏） */
    computeOrderSummaryPayload(sourceDishes) {
        const selected = sourceDishes.filter((d) => (d.orderCount || 0) > 0);
        const orderDishCount = selected.length;
        const orderItemCount = selected.reduce((sum, d) => sum + (d.orderCount || 0), 0);
        let amount = 0;
        let pricedItemCount = 0;
        const lines = [];
        selected.forEach((dish) => {
            const count = dish.orderCount || 0;
            lines.push(`${dish.originalName || dish.briefCN || "未命名菜品"} x${count}`);
            const priceNumber = this.parsePriceNumber(String(dish.detail?.price || ""));
            if (Number.isFinite(priceNumber)) {
                amount += priceNumber * count;
                pricedItemCount += count;
            }
        });
        const amountBaseSymbol = detectMenuCurrencySymbol(selected);
        const orderAmountText = pricedItemCount > 0 ? `${amountBaseSymbol || "¥"}${amount.toFixed(2)}` : "待定";
        const orderSummaryText = lines.length > 0 ? lines.join("\n") : "";
        const orderListItems = selected.map((dish) => {
            const key = dish.key || this.getDishIdentity(dish, 0);
            const idx = sourceDishes.findIndex((d) => (d.key || "") === key);
            return {
                key,
                name: dish.originalName || dish.briefCN || "未命名菜品",
                price: String(dish.detail?.price || "").trim() || "—",
                count: dish.orderCount || 0,
                scrollIndex: idx >= 0 ? idx : 0,
            };
        });
        return {
            orderDishCount,
            orderItemCount,
            orderAmountText,
            orderSummaryText,
            orderListItems,
        };
    },
    startPolling(recordId) {
        this.stopPolling();
        const intervalMs = 600;
        const pollStartTime = Date.now();
        const tick = async () => {
            if (Date.now() - pollStartTime > 90000) {
                this.stopPolling();
                try {
                    const lastRecord = await (0, history_1.getRecordById)(recordId);
                    const partialCount = (lastRecord?.partialDishes?.length ?? 0) || (lastRecord?.dishes?.length ?? 0);
                    if (lastRecord && partialCount > 0) {
                        this.applyRecord(lastRecord);
                        this.setData({
                            processing: false,
                            error: "",
                            menuTooLongHint: "当前菜单太长，识别不完整。请你分段拍摄，以获取最佳体验。",
                        });
                    }
                    else {
                        this.setData({
                            processing: false,
                            error: "识别超时，请返回重试",
                        });
                    }
                }
                catch {
                    this.setData({
                        processing: false,
                        error: "识别超时，请返回重试",
                    });
                }
                return;
            }
            try {
                const record = await (0, history_1.getRecordById)(recordId);
                if (!record) {
                    this.stopPolling();
                    this.setData({
                        initialLoading: false,
                        processing: false,
                        error: "未找到记录",
                    });
                    return;
                }
                this.applyRecord(record);
                if (record.status !== "processing") {
                    this.stopPolling();
                    return;
                }
            }
            catch {
                this.stopPolling();
                this.setData({
                    initialLoading: false,
                    processing: false,
                    error: "刷新状态失败，请返回重试",
                });
                return;
            }
            this._pollTimer = setTimeout(tick, intervalMs);
        };
        tick();
    },
    stopPolling() {
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
            this._pollTimer = 0;
        }
    },
    onUnload() {
        this.stopPolling();
        if (this._processingTimer) {
            clearTimeout(this._processingTimer);
            this._processingTimer = 0;
        }
    },
    onRetakePhoto() {
        wx.navigateBack();
    },
    onImageError() {
        if (this.data.imageFileID) {
            this.setData({ imageFileID: "" });
        }
    },
    onDishTap(e) {
        const index = Number(e.currentTarget.dataset.index);
        const { dishes } = this.data;
        // Guard: undefined/invalid dataset.index yields NaN; avoid crash on dishes[NaN]
        if (Number.isNaN(index) || index < 0 || index >= dishes.length)
            return;
        let dish = dishes[index];
        const key = dish.key || this.getDishIdentity(dish, index);
        const nextExpanded = !dish.expanded;
        if (dish.expanded)
            this._expandedKeys.delete(key);
        else
            this._expandedKeys.add(key);
        if (nextExpanded)
            dish = this.ensureDetailForExpand(dish);
        const allDishes = this.data.allDishes.map((item, itemIndex) => {
            const itemKey = item.key || this.getDishIdentity(item, itemIndex);
            return itemKey === key ? Object.assign({}, dish, { expanded: nextExpanded }) : item;
        });
        const nextDishes = this.filterDishesByCategory(allDishes, this.data.activeCategory);
        this.setData({ allDishes, dishes: nextDishes });
    },
    onCategoryTap(e) {
        const key = String(e.currentTarget.dataset.key || "all");
        if (key === this.data.activeCategory)
            return;
        this.setData({ activeCategory: key });
        this.refreshVisibleDishes();
    },
    onCategoryExpandTap() {
        this.setData({ categoryExpanded: !this.data.categoryExpanded });
    },
    onAddOrder(e) {
        const key = String(e.currentTarget.dataset.key || "");
        if (!key)
            return;
        const count = (this._orderMap.get(key) || 0) + 1;
        this._orderMap.set(key, count);
        this.syncOrderCountByKey(key, count);
    },
    onDecreaseOrder(e) {
        const key = String(e.currentTarget.dataset.key || "");
        if (!key)
            return;
        const current = this._orderMap.get(key) || 0;
        const next = Math.max(0, current - 1);
        if (next === 0)
            this._orderMap.delete(key);
        else
            this._orderMap.set(key, next);
        this.syncOrderCountByKey(key, next);
    },
    syncOrderCountByKey(key, count) {
        const allDishes = this.data.allDishes.map((dish) => dish.key === key ? Object.assign({}, dish, { orderCount: count }) : dish);
        const dishes = this.filterDishesByCategory(allDishes, this.data.activeCategory);
        const summary = this.computeOrderSummaryPayload(allDishes);
        const showOrderBar = summary.orderItemCount >= 1;
        this.setData({
            orderDishCount: summary.orderDishCount,
            orderItemCount: summary.orderItemCount,
            orderAmountText: summary.orderAmountText,
            orderSummaryText: summary.orderSummaryText,
            orderListItems: summary.orderListItems,
            showOrderBar,
        });
        this.setData({ allDishes, dishes });
    },
    /** 仅阻止冒泡：点击数量区域时不触发展开/收起 */
    onStepperAreaTap() { },
    onOrderSummaryTap() {
        if (this.data.orderItemCount <= 0)
            return;
        this.setData({ orderDetailVisible: !this.data.orderDetailVisible });
    },
    onCloseOrderDetail() {
        this.setData({ orderDetailVisible: false });
    },
    onRecommendationTap(e) {
        const dishIndex = Number(e.currentTarget.dataset.index ?? -1);
        if (dishIndex < 0 || dishIndex >= this.data.allDishes.length)
            return;
        const { allDishes, activeCategory } = this.data;
        const scrollToDish = () => {
            this.setData({ scrollIntoId: "dish-" + dishIndex });
            setTimeout(() => this.setData({ scrollIntoId: "" }), 600);
        };
        if (activeCategory !== "all") {
            this.setData({ activeCategory: "all", dishes: allDishes }, () => {
                setTimeout(scrollToDish, 80);
            });
        }
        else {
            setTimeout(scrollToDish, 80);
        }
    },
    onOrderItemTap(e) {
        const key = String(e.currentTarget.dataset.key || "");
        const scrollIndex = Number(e.currentTarget.dataset.scrollIndex);
        if (!key)
            return;
        this.setData({ orderDetailVisible: false });
        const { allDishes, activeCategory } = this.data;
        const inAllDishes = allDishes.some((d) => (d.key || "") === key);
        if (!inAllDishes)
            return;
        const scrollToDish = () => {
            this.setData({ scrollIntoId: "dish-" + scrollIndex });
            setTimeout(() => this.setData({ scrollIntoId: "" }), 600);
        };
        if (activeCategory !== "all") {
            this.setData({ activeCategory: "all", dishes: allDishes }, () => {
                setTimeout(scrollToDish, 80);
            });
        }
        else {
            setTimeout(scrollToDish, 80);
        }
    },
});
