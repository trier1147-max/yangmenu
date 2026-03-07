"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const history_1 = require("../../services/history");
function isPlaceholderIngredient(value) {
    const raw = String(value !== null && value !== void 0 ? value : "").trim();
    if (!raw)
        return true;
    const normalized = raw
        .toLowerCase()
        .replace(/[锛?()锛堬級\[\]銆愩€慮/g, "")
        .replace(/\s+/g, "");
    const genericOnly = /^(椋熸潗|鍘熸枡|閰嶆枡|鏉愭枡|涓绘枡|杈呮枡|浣愭枡|璋冩枡|ingredient|ingredients|material|materials|item|food)$/i;
    return (genericOnly.test(raw) ||
        /^(椋熸潗|鍘熸枡|閰嶆枡|鏉愭枡|涓绘枡|杈呮枡|浣愭枡|璋冩枡)[a-z0-9涓€浜屼笁鍥涗簲鍏竷鍏節鍗佺敳涔欎笝涓乚?$/.test(raw) ||
        /(椋熸潗|鍘熸枡|閰嶆枡|鏉愭枡|ingredient|material)[-_:锛?]?[a-z0-9涓€浜屼笁鍥涗簲鍏竷鍏節鍗佺敳涔欎笝涓乚+$/i.test(raw) ||
        /^(ingredient|ingredients|material|materials)[-_ ]?[a-z0-9]+$/i.test(raw) ||
        /^(item|food)[-_ ]?[a-z0-9]+$/i.test(raw) ||
        /(绀轰緥|鏍蜂緥|鍗犱綅|placeholder|sample|demo|test|mock)/i.test(raw) ||
        /^(a|b|c|d|e|f|g|1|2|3|4|5|6)$/.test(normalized));
}
function normalizeIngredients(list) {
    if (!Array.isArray(list) && typeof list !== "string")
        return [];
    const seen = new Set();
    const result = [];
    const rawList = Array.isArray(list) ? list : [list];
    rawList.forEach((item) => {
        const value = String(item !== null && item !== void 0 ? item : "").trim();
        if (!value)
            return;
        const parts = value
            .split(/[銆?锛?锛?|]/)
            .map((part) => part
            .trim()
            .replace(/^[\-鈥⒙穃s]+/, "")
            .replace(/^(椋熸潗|鍘熸枡|閰嶆枡|鏉愭枡|涓绘枡|杈呮枡|浣愭枡|璋冩枡)[锛?]\s*/i, "")
            .trim())
            .filter(Boolean);
        const candidates = parts.length > 0 ? parts : [value];
        candidates.forEach((candidate) => {
            if (!candidate || isPlaceholderIngredient(candidate) || seen.has(candidate))
                return;
            seen.add(candidate);
            if (result.length < 6)
                result.push(candidate);
        });
    });
    return result;
}
function normalizeImageSource(raw) {
    const src = String(raw !== null && raw !== void 0 ? raw : "").trim();
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
    const value = String(raw !== null && raw !== void 0 ? raw : "").trim();
    if (!value)
        return "";
    const normalized = value.replace(/^妤?, "").replace(/\s+/g, " ");
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
    const symbolMatch = value.match(/^(?:\u00A5|\uFFE5|\$|\u20AC|\u00A3|\u20A9|\u20BD|\u20B9|\u0E3F|\u20AB|\u20BA|\u20B4|\u20B1|CHF|HK\$|MOP\$|NT\$|R\$|A\$|C\$)/i);
    return symbolMatch ? symbolMatch[0] : "";
}
function detectMenuCurrencySymbol(dishes) {
    const counter = {};
    dishes.forEach((dish) => {
        var _a;
        const price = String(((_a = dish.detail) === null || _a === void 0 ? void 0 : _a.price) !== null && ((_a = dish.detail) === null || _a === void 0 ? void 0 : _a.price) !== void 0 ? ((_a = dish.detail) === null || _a === void 0 ? void 0 : _a.price) : "").trim();
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
    const value = String(rule !== null && rule !== void 0 ? rule : "").trim();
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
        var _a, _b, _c;
        const obj = item !== null && item !== void 0 ? item : {};
        const group = String((_c = (_b = (_a = obj.group) !== null && _a !== void 0 ? _a : obj.name) !== null && _b !== void 0 ? _b : obj.title) !== null && _c !== void 0 ? _c : "").trim();
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
            var _a, _b, _c;
            const text = typeof entry === "string"
                ? entry.trim()
                : String((_c = (_b = (_a = entry === null || entry === void 0 ? void 0 : entry.name) !== null && _a !== void 0 ? _a : entry === null || entry === void 0 ? void 0 : entry.label) !== null && _b !== void 0 ? _b : entry === null || entry === void 0 ? void 0 : entry.value) !== null && _c !== void 0 ? _c : "").trim();
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
Page({
    data: {
        recordId: "",
        imageFileID: "",
        dishes: [],
        initialLoading: true,
        processing: false,
        timeoutHint: "",
        error: "",
    },
    _processingTimer: 0,
    _pollTimer: 0,
    _expandedKeys: new Set(),
    async onLoad(options) {
        var _a;
        const recordId = (_a = options === null || options === void 0 ? void 0 : options.recordId) !== null && _a !== void 0 ? _a : "";
        this.setData({
            recordId,
            initialLoading: true,
            processing: false,
            timeoutHint: "",
            error: "",
        });
        if (!recordId) {
            this.setData({ initialLoading: false, error: "缂哄皯璁板綍 ID" });
            return;
        }
        this._processingTimer = setTimeout(() => {
            if (this.data.processing) {
                this.setData({ timeoutHint: "璇嗗埆鏃堕棿杈冮暱锛屽彲鑳界綉缁滄垨鏈嶅姟绻佸繖锛屽彲杩斿洖閲嶈瘯" });
            }
        }, 30000);
        try {
            const record = await (0, history_1.getRecordById)(recordId);
            if (!record) {
                this.setData({ initialLoading: false, error: "鏈壘鍒拌褰? });
                return;
            }
            this.applyRecord(record);
            if (record.status === "processing") {
                this.startPolling(recordId);
            }
        }
        catch (_b) {
            this.setData({ initialLoading: false, error: "鍔犺浇澶辫触锛岃閲嶈瘯" });
        }
    },
    applyRecord(record) {
        var _a, _b, _c;
        const list = (_b = (((_a = record.partialDishes) === null || _a === void 0 ? void 0 : _a.length) ? record.partialDishes : record.dishes)) !== null && _b !== void 0 ? _b : [];
        const menuCurrencySymbol = detectMenuCurrencySymbol(list);
        const dishes = list.map((d, index) => {
            var _a, _b, _c, _d, _e;
            const normalizedDescription = String(((_a = d.detail) === null || _a === void 0 ? void 0 : _a.description) || "").toLowerCase() === "manual input"
                ? ""
                : ((_b = d.detail) === null || _b === void 0 ? void 0 : _b.description) || "";
            const normalizedRecommendation = ((_c = d.detail) === null || _c === void 0 ? void 0 : _c.recommendation) || "";
            const mergedFlavor = [((_d = d.detail) === null || _d === void 0 ? void 0 : _d.flavor) || "", normalizedRecommendation]
                .filter(Boolean)
                .join("\n鎺ㄨ崘锛?);
            const detail = d.detail
                ? Object.assign(Object.assign({}, d.detail), { description: normalizedDescription, background: d.detail.background || "", ingredients: normalizeIngredients(d.detail.ingredients), flavor: mergedFlavor, price: applyCurrencySymbol(normalizePrice(d.detail.price), menuCurrencySymbol), options: normalizeOptionGroups(d.detail.options), recommendation: "" }) : d.detail;
            const key = this.getDishIdentity(d, index);
            return Object.assign(Object.assign({}, d), { detail, expanded: this._expandedKeys.has(key) });
        });
        const processing = record.status === "processing";
        const error = record.status === "error" ? record.errorMessage || "璇嗗埆澶辫触" : "";
        const hasProgress = dishes.length > 0;
        const clearHint = !processing || hasProgress;
        this.setData({
            imageFileID: normalizeImageSource((_c = record.imageFileID) !== null && _c !== void 0 ? _c : ""),
            dishes,
            initialLoading: false,
            processing,
            timeoutHint: clearHint ? "" : this.data.timeoutHint,
            error,
        });
        if (record.status === "done" || record.status === "error") {
            this.stopPolling();
        }
    },
    getDishIdentity(dish, index) {
        var _a;
        const name = String(dish.originalName !== null && dish.originalName !== void 0 ? dish.originalName : "").trim();
        const brief = String(dish.briefCN !== null && dish.briefCN !== void 0 ? dish.briefCN : "").trim();
        const price = String(((_a = dish.detail) === null || _a === void 0 ? void 0 : _a.price) !== null && ((_a = dish.detail) === null || _a === void 0 ? void 0 : _a.price) !== void 0 ? ((_a = dish.detail) === null || _a === void 0 ? void 0 : _a.price) : "").trim();
        return `${name}__${brief}__${price || index}`;
    },
    startPolling(recordId) {
        this.stopPolling();
        const intervalMs = 1200;
        const tick = async () => {
            try {
                const record = await (0, history_1.getRecordById)(recordId);
                if (!record) {
                    this.stopPolling();
                    this.setData({
                        initialLoading: false,
                        processing: false,
                        error: "鏈壘鍒拌褰?,
                    });
                    return;
                }
                this.applyRecord(record);
                if (record.status !== "processing") {
                    this.stopPolling();
                    return;
                }
            }
            catch (_a) {
                this.stopPolling();
                this.setData({
                    initialLoading: false,
                    processing: false,
                    error: "鍒锋柊鐘舵€佸け璐ワ紝璇疯繑鍥為噸璇?,
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
        if (index < 0 || index >= dishes.length)
            return;
        const dish = dishes[index];
        const key = this.getDishIdentity(dish, index);
        if (dish.expanded)
            this._expandedKeys.delete(key);
        else
            this._expandedKeys.add(key);
        this.setData({ [`dishes[${index}].expanded`]: !dish.expanded });
    },
});

