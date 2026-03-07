"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const toast_1 = __importDefault(require("@vant/weapp/toast/toast"));
const ai_1 = require("../../services/ai");
const cloud_1 = require("../../services/cloud");
const history_1 = require("../../services/history");
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"];
/** Validate image files: size <= 4MB, format jpg/jpeg/png. Returns error message or null if valid. */
function validateImageFiles(files) {
    var _a, _b, _c;
    if (!files || files.length === 0)
        return null;
    for (const f of files) {
        const size = (_a = f.size) !== null && _a !== void 0 ? _a : 0;
        if (size > MAX_IMAGE_SIZE_BYTES) {
            return "size";
        }
        const path = f.tempFilePath || "";
        const ext = (_c = (_b = path.split(".").pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase()) !== null && _c !== void 0 ? _c : "";
        const hasExtension = path.includes(".") && ext.length > 0;
        if (hasExtension) {
            if (!ALLOWED_EXTENSIONS.includes(ext))
                return "format";
        }
        else {
            if (f.fileType !== "image")
                return "format";
        }
    }
    return null;
}
Page({
    data: {
        recentRecords: [],
        loading: false,
        loadingEmoji: "👨‍🍳",
        loadingBadge: "菜单小剧场",
        loadingText: "识别中...",
        showManualInput: false,
        manualInputText: "",
        isProcessing: false,
    },
    loadingTimer: 0,
    onShow() {
        this.refreshData();
    },
    refreshData() {
        return __awaiter(this, void 0, void 0, function* () {
            const recentRecords = yield (0, history_1.getRecentRecords)(3);
            this.setData({ recentRecords });
        });
    },
    /** 轮询直到解析出至少一道菜，或识别完成/报错/超时。成功时返回 record 供跳转页直接使用，避免二次请求。 */
    waitForAtLeastOneDish(recordId_1) {
        return __awaiter(this, arguments, void 0, function* (recordId, timeoutMs = 35000) {
            var _a, _b, _c, _d;
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
                const record = yield (0, history_1.getRecordById)(recordId);
                if (record) {
                    const count = ((_b = (_a = record.partialDishes) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) || ((_d = (_c = record.dishes) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0);
                    if (count > 0) {
                        const full = record;
                        return { hasDish: true, record: Object.assign({}, full, { _id: recordId }) };
                    }
                    if (record.status === "done" || record.status === "error") {
                        const err = record.errorMessage;
                        return { hasDish: false, errorMessage: err };
                    }
                }
                yield new Promise((r) => setTimeout(r, 1200));
            }
            return { hasDish: false };
        });
    },
    onTakePhoto() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data.isProcessing)
                return;
            this.setData({ isProcessing: true });
            try {
                const res = yield wx.chooseMedia({
                    count: 6,
                    mediaType: ["image"],
                    sourceType: ["camera"],
                });
                const valErr = validateImageFiles(res.tempFiles);
                if (valErr) {
                    wx.showToast({
                        title: valErr === "size" ? "图片不能超过4MB，请重新选择" : "仅支持 JPG/PNG 格式",
                        icon: "none",
                    });
                    return;
                }
                const usageResult = yield (0, cloud_1.consumeDailyUsage)();
                if (usageResult.success && usageResult.canProceed) {
                    yield this.handleMediaResult(res);
                }
                else if (usageResult.success && !usageResult.canProceed) {
                    wx.showModal({
                        title: "今日次数已用完",
                        content: "每日可免费识别 6 次，明天再来吧！",
                        showCancel: false,
                    });
                }
                else {
                    wx.showToast({
                        title: "网络异常，请检查网络后重试",
                        icon: "none",
                        duration: 2000,
                    });
                }
            }
            catch (e) {
                const errMsg = (e === null || e === void 0 ? void 0 : e.errMsg) || (e === null || e === void 0 ? void 0 : e.message) || (typeof e === "string" ? e : "");
                if (errMsg.includes("cancel"))
                    return; // 用户主动取消，静默返回
                clearInterval(this.loadingTimer);
                this.setData({ loading: false });
                toast_1.default.fail(errMsg || "操作失败，请重试");
            }
            finally {
                this.setData({ isProcessing: false });
            }
        });
    },
    onChooseAlbum() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.data.isProcessing)
                return;
            this.setData({ isProcessing: true });
            try {
                const res = yield wx.chooseMedia({
                    count: 6,
                    mediaType: ["image"],
                    sourceType: ["album"],
                });
                const valErr = validateImageFiles(res.tempFiles);
                if (valErr) {
                    wx.showToast({
                        title: valErr === "size" ? "图片不能超过4MB，请重新选择" : "仅支持 JPG/PNG 格式",
                        icon: "none",
                    });
                    return;
                }
                const usageResult = yield (0, cloud_1.consumeDailyUsage)();
                if (usageResult.success && usageResult.canProceed) {
                    yield this.handleMediaResult(res);
                }
                else if (usageResult.success && !usageResult.canProceed) {
                    wx.showModal({
                        title: "今日次数已用完",
                        content: "每日可免费识别 6 次，明天再来吧！",
                        showCancel: false,
                    });
                }
                else {
                    wx.showToast({
                        title: "网络异常，请检查网络后重试",
                        icon: "none",
                        duration: 2000,
                    });
                }
            }
            catch (e) {
                const errMsg = (e === null || e === void 0 ? void 0 : e.errMsg) || (e === null || e === void 0 ? void 0 : e.message) || (typeof e === "string" ? e : "");
                if (errMsg.includes("cancel"))
                    return; // 用户主动取消，静默返回
                clearInterval(this.loadingTimer);
                this.setData({ loading: false });
                toast_1.default.fail(errMsg || "操作失败，请重试");
            }
            finally {
                this.setData({ isProcessing: false });
            }
        });
    },
    onManualInput() {
        this.setData({ showManualInput: true, manualInputText: "" });
    },
    onManualInputChange(e) {
        this.setData({ manualInputText: e.detail.value });
    },
    onManualInputClose() {
        this.setData({ showManualInput: false, manualInputText: "" });
    },
    onManualInputCancel() {
        this.setData({ showManualInput: false, manualInputText: "" });
    },
    onManualInputConfirm() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            if (this.data.isProcessing)
                return;
            const text = (this.data.manualInputText || "").trim();
            this.setData({ showManualInput: false, manualInputText: "" });
            if (!text) {
                (0, toast_1.default)("请至少输入一个菜名");
                return;
            }
            const dishNames = this.parseManualNames(text);
            if (dishNames.length === 0) {
                (0, toast_1.default)("未识别到有效菜名");
                return;
            }
            this.setData({ isProcessing: true });
            try {
                const usageResult = yield (0, cloud_1.consumeDailyUsage)();
                if (usageResult.success && usageResult.canProceed) {
                    // proceed
                }
                else if (usageResult.success && !usageResult.canProceed) {
                    wx.showModal({
                        title: "今日次数已用完",
                        content: "每日可免费识别 6 次，明天再来吧！",
                        showCancel: false,
                    });
                    return;
                }
                else {
                    wx.showToast({
                        title: "网络异常，请检查网络后重试",
                        icon: "none",
                        duration: 2000,
                    });
                    return;
                }
                this.setData({
                    loading: true,
                    loadingEmoji: "📝",
                    loadingBadge: "点菜顾问已就位",
                    loadingText: "正在给这道菜补上好懂的介绍...",
                });
                const result = yield (0, ai_1.recognizeManualDishes)(dishNames);
                this.setData({ loading: false });
                if (!result.recordId || ((_b = (_a = result.dishes) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) < 1) {
                    toast_1.default.fail(result.error || "未识别到有效菜品");
                    return;
                }
                const app = getApp();
                app.globalData.pendingRecord = {
                    _id: result.recordId,
                    _openid: "",
                    imageFileID: "",
                    dishes: (_c = result.dishes) !== null && _c !== void 0 ? _c : [],
                    status: "done",
                    createdAt: new Date(),
                };
                wx.navigateTo({
                    url: `/pages/menu-list/menu-list?recordId=${result.recordId}`,
                });
            }
            catch (e) {
                this.setData({ loading: false });
                const errMsg = (e === null || e === void 0 ? void 0 : e.errMsg) || (e === null || e === void 0 ? void 0 : e.message) || (typeof e === "string" ? e : "");
                toast_1.default.fail(errMsg || "操作失败，请重试");
            }
            finally {
                this.setData({ isProcessing: false });
            }
        });
    },
    /** 解析手动输入的菜名，支持中英文逗号、分号、顿号、换行分隔 */
    parseManualNames(text) {
        const normalized = text.replace(/[\r\t]/g, " ");
        // 中英文逗号(，,)、分号(；;)、顿号(、)均可分隔
        const parts = normalized
            .split(/[\n,;\uFF0C\uFF1B\u3001]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 40);
        const seen = new Set();
        const names = [];
        parts.forEach((name) => {
            if (seen.has(name))
                return;
            seen.add(name);
            names.push(name);
        });
        return names;
    },
    handleMediaResult(res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const files = (_a = res.tempFiles) !== null && _a !== void 0 ? _a : [];
            if (files.length === 0)
                return;
            this.setData({
                loading: true,
                loadingEmoji: "👨‍🍳",
                loadingBadge: "菜单小剧场",
                loadingText: "大厨正在解读这份菜单...",
            });
            let timeElapsed = 0;
            this.loadingTimer = setInterval(() => {
                timeElapsed += 3;
                if (timeElapsed >= 3 && timeElapsed < 7) {
                    this.setData({
                        loadingEmoji: "🍲",
                        loadingBadge: "正在备菜",
                        loadingText: "先帮你看看这页菜单里都有什么...",
                    });
                }
                else if (timeElapsed >= 7) {
                    this.setData({
                        loadingEmoji: "🍽️",
                        loadingBadge: "准备上桌",
                        loadingText: "菜品马上整理好，稍等一下...",
                    });
                }
            }, 3000);
            try {
                const filePaths = files.map((f) => f.tempFilePath);
                const compressed = yield Promise.all(filePaths.map((path) => wx.compressImage({
                    src: path,
                    quality: 50,
                    compressedWidth: 960,
                })));
                const fileIDs = yield Promise.all(compressed.map((c) => (0, ai_1.uploadImage)(c.tempFilePath)));
                const allDishes = [];
                let recordId = null;
                let lastError = "";
                if (fileIDs.length === 1) {
                    const streamRes = yield (0, ai_1.recognizeMenuStream)(fileIDs[0]);
                    recordId = (_b = streamRes.recordId) !== null && _b !== void 0 ? _b : null;
                    if (streamRes.error)
                        lastError = streamRes.error;
                    if (recordId) {
                        const { hasDish, errorMessage, record } = yield this.waitForAtLeastOneDish(recordId);
                        if (!hasDish) {
                            recordId = null;
                            lastError = errorMessage || lastError || "未识别到有效菜品";
                        }
                        else if (record) {
                            getApp().globalData.pendingRecord = record;
                        }
                    }
                    else {
                        lastError = lastError || "识别服务启动失败，请重试";
                    }
                }
                else {
                    const results = yield Promise.all(fileIDs.map((fileID) => (0, ai_1.recognizeMenu)(fileID, false)));
                    results.forEach((r) => {
                        r.dishes.forEach((d) => allDishes.push(d));
                        if (r.error)
                            lastError = r.error;
                    });
                    if (allDishes.length > 0) {
                        recordId = yield (0, ai_1.saveRecord)(fileIDs[0], allDishes);
                        if (recordId) {
                            const app = getApp();
                            app.globalData.pendingRecord = {
                                _id: recordId,
                                _openid: "",
                                imageFileID: fileIDs[0],
                                dishes: allDishes,
                                status: "done",
                                createdAt: new Date(),
                            };
                        }
                    }
                    else {
                        lastError = lastError || "未识别到有效菜品";
                    }
                }
                clearInterval(this.loadingTimer);
                this.setData({ loading: false });
                if (recordId) {
                    wx.navigateTo({
                        url: `/pages/menu-list/menu-list?recordId=${recordId}`,
                    });
                }
                else {
                    toast_1.default.fail(lastError || "识别失败，请重试");
                }
            }
            catch (e) {
                console.error("recognition failed:", e);
                clearInterval(this.loadingTimer);
                this.setData({ loading: false });
                const errMsg = (e === null || e === void 0 ? void 0 : e.errMsg) || (e === null || e === void 0 ? void 0 : e.message) || (typeof e === "string" ? e : "");
                toast_1.default.fail(errMsg || "识别失败，请重试");
            }
        });
    },
    onRecordTap(e) {
        const ds = e.currentTarget.dataset;
        const recordId = (ds.recordId || ds.recordid || "");
        if (recordId) {
            wx.navigateTo({
                url: `/pages/menu-list/menu-list?recordId=${recordId}`,
            });
        }
    },
    onDeleteRecentRecord(e) {
        return __awaiter(this, void 0, void 0, function* () {
            const ds = e.currentTarget.dataset;
            const recordId = (ds.recordId || ds.recordid || "");
            if (!recordId)
                return;
            const modalRes = yield wx.showModal({
                title: "删除记录",
                content: "确认删除这条识别记录吗？删除后不可恢复。",
                confirmText: "删除",
                confirmColor: "#ee0a24",
                cancelText: "取消",
            });
            if (!modalRes.confirm)
                return;
            const ok = yield (0, history_1.deleteRecordById)(recordId);
            if (!ok) {
                toast_1.default.fail("删除失败，请重试");
                return;
            }
            this.setData({
                recentRecords: this.data.recentRecords.filter((item) => item._id !== recordId),
            });
            toast_1.default.success("已删除");
        });
    },
    onViewAllHistory() {
        wx.navigateTo({ url: "/pages/history/history" });
    },
});
