"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const toast_1 = __importDefault(require("@vant/weapp/toast/toast"));
const ai_1 = require("../../services/ai");
const history_1 = require("../../services/history");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
Page({
    data: {
        recentRecords: [],
        loading: false,
        loadingEmoji: "👨‍🍳",
        loadingBadge: "菜单小剧场",
        loadingText: "识别中...",
    },
    loadingTimer: 0,
    onShow() {
        this.refreshData();
    },
    async refreshData() {
        const recentRecords = await (0, history_1.getRecentRecords)(3);
        this.setData({ recentRecords });
    },
    async waitForAtLeastOneDish(recordId, timeoutMs = 35000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const record = await (0, history_1.getRecordById)(recordId);
            if (record) {
                const count = ((record.partialDishes === null || record.partialDishes === void 0 ? void 0 : record.partialDishes.length) || (record.dishes === null || record.dishes === void 0 ? void 0 : record.dishes.length) || 0);
                if (count > 0)
                    return true;
                if (record.status === "done" || record.status === "error")
                    return false;
            }
            await sleep(1200);
        }
        return false;
    },
    async onTakePhoto() {
        const res = await wx.chooseMedia({
            count: 6,
            mediaType: ["image"],
            sourceType: ["camera"],
        });
        this.handleMediaResult(res);
    },
    async onChooseAlbum() {
        const res = await wx.chooseMedia({
            count: 6,
            mediaType: ["image"],
            sourceType: ["album"],
        });
        this.handleMediaResult(res);
    },
    async onManualInput() {
        const modal = await wx.showModal({
            title: "手动输入",
            editable: true,
            placeholderText: "请输入菜名，支持换行或逗号分隔",
            confirmText: "确认",
            cancelText: "取消",
        });
        if (!modal.confirm)
            return;
        const text = (modal.content || "").trim();
        if (!text) {
            (0, toast_1.default)("请至少输入一个菜名");
            return;
        }
        const dishNames = this.parseManualNames(text);
        if (dishNames.length === 0) {
            (0, toast_1.default)("未识别到有效菜名");
            return;
        }
        this.setData({
            loading: true,
            loadingEmoji: "📝",
            loadingBadge: "点菜顾问已就位",
            loadingText: "正在给这道菜补上好懂的介绍...",
        });
        try {
            const result = await (0, ai_1.recognizeManualDishes)(dishNames);
            this.setData({ loading: false });
            if (!result.recordId || (((result.dishes === null || result.dishes === void 0 ? void 0 : result.dishes.length) || 0) < 1)) {
                toast_1.default.fail(result.error || "未识别到有效菜品");
                return;
            }
            wx.navigateTo({
                url: `/pages/menu-list/menu-list?recordId=${result.recordId}`,
            });
        }
        catch (e) {
            this.setData({ loading: false });
            const msg = e instanceof Error ? e.message : String(e);
            toast_1.default.fail(msg || "保存失败，请重试");
        }
    },
    parseManualNames(text) {
        const normalized = text
            .replace(/[\uFF0C\uFF1B\u3001]/g, ",")
            .replace(/[\r\t]/g, " ");
        const parts = normalized
            .split(/[\n,;]+/)
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
    async handleMediaResult(res) {
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
            const compressed = await Promise.all(filePaths.map((path) => wx.compressImage({
                src: path,
                quality: 50,
                compressedWidth: 960,
            })));
            const fileIDs = await Promise.all(compressed.map((c) => (0, ai_1.uploadImage)(c.tempFilePath)));
            const allDishes = [];
            let recordId = null;
            let lastError = "";
            if (fileIDs.length === 1) {
                const streamRes = await (0, ai_1.recognizeMenuStream)(fileIDs[0]);
                recordId = (_b = streamRes.recordId) !== null && _b !== void 0 ? _b : null;
                if (streamRes.error)
                    lastError = streamRes.error;
                if (recordId) {
                    const hasDish = await this.waitForAtLeastOneDish(recordId);
                    if (!hasDish) {
                        recordId = null;
                        lastError = lastError || "未识别到有效菜品";
                    }
                }
            }
            else {
                const results = await Promise.all(fileIDs.map((fileID) => (0, ai_1.recognizeMenu)(fileID, false)));
                results.forEach((r) => {
                    allDishes.push(...r.dishes);
                    if (r.error)
                        lastError = r.error;
                });
                if (allDishes.length > 0) {
                    recordId = await (0, ai_1.saveRecord)(fileIDs[0], allDishes);
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
            const msg = e instanceof Error ? e.message : String(e);
            toast_1.default.fail(msg || "识别失败，请重试");
        }
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
    async onDeleteRecentRecord(e) {
        const ds = e.currentTarget.dataset;
        const recordId = (ds.recordId || ds.recordid || "");
        if (!recordId)
            return;
        const modalRes = await wx.showModal({
            title: "Delete Record",
            content: "Delete this recognition record? This action cannot be undone.",
            confirmText: "Delete",
            confirmColor: "#ee0a24",
            cancelText: "Cancel",
        });
        if (!modalRes.confirm)
            return;
        const ok = await (0, history_1.deleteRecordById)(recordId);
        if (!ok) {
            toast_1.default.fail("Delete failed, please retry");
            return;
        }
        this.setData({
            recentRecords: this.data.recentRecords.filter((item) => item._id !== recordId),
        });
        toast_1.default.success("Deleted");
    },
    onViewAllHistory() {
        wx.navigateTo({ url: "/pages/history/history" });
    },
});
