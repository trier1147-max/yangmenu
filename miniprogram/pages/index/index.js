"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const toast_1 = __importDefault(require("@vant/weapp/toast/toast"));
const ai_1 = require("../../services/ai");
const history_1 = require("../../services/history");
const user_1 = require("../../services/user");
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"];
/** base64 超限时兜底走上传流式；设 500KB 确保绝大多数图走 base64 主路径 */
const BASE64_CALL_LIMIT = 500000;
/** Validate image files: size <= 4MB, format jpg/jpeg/png. Returns error message or null if valid. */
function validateImageFiles(files) {
    if (!files || files.length === 0)
        return null;
    for (const f of files) {
        const size = f.size ?? 0;
        if (size > MAX_IMAGE_SIZE_BYTES) {
            return "size";
        }
        const path = f.tempFilePath || "";
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
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
        remaining: 6,
        total: 6,
        canShare: true,
        showLimitDialog: false,
    },
    loadingTimer: 0,
    onShow() {
        // 用户从相机/相册返回但未选图时，wx.chooseMedia 可能不回调，导致 isProcessing 一直为 true。
        // 此时 loading 为 false（尚未进入 handleMediaResult），可安全重置。
        if (this.data.isProcessing && !this.data.loading) {
            this.setData({ isProcessing: false });
        }
        this.refreshData();
    },
    async refreshData() {
        const [recentRecords, usage] = await Promise.all([
            (0, history_1.getRecentRecords)(3),
            (0, user_1.checkUsage)(),
        ]);
        this.setData({
            recentRecords,
            remaining: usage.remaining,
            total: usage.total,
            canShare: usage.canShare,
        });
    },
    async onTakePhoto() {
        if (this.data.isProcessing)
            return;
        const usage = await (0, user_1.checkUsage)();
        if (usage.remaining <= 0) {
            this.setData({ showLimitDialog: true });
            return;
        }
        try {
            const res = await new Promise((resolve, reject) => {
                wx.chooseMedia({
                    count: 6,
                    mediaType: ["image"],
                    sourceType: ["camera"],
                    sizeType: ["original"],
                    success: resolve,
                    fail: reject,
                    complete: () => {
                        // 选图界面关闭时（含左滑返回）确保可再次点击
                        if (this.data.isProcessing && !this.data.loading) {
                            this.setData({ isProcessing: false });
                        }
                    },
                });
            });
            const valErr = validateImageFiles(res.tempFiles);
            if (valErr) {
                wx.showToast({
                    title: valErr === "size" ? "图片不能超过4MB，请重新选择" : "仅支持 JPG/PNG 格式",
                    icon: "none",
                });
                return;
            }
            this.setData({ isProcessing: true });
            await this.handleMediaResult(res);
        }
        catch (e) {
            const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
            if (errMsg.includes("cancel"))
                return; // 用户主动取消，静默返回
            clearInterval(this.loadingTimer);
            this.setData({ loading: false });
            toast_1.default.fail(errMsg || "操作失败，请重试");
        }
        finally {
            this.setData({ isProcessing: false });
        }
    },
    async onChooseAlbum() {
        if (this.data.isProcessing)
            return;
        const usage = await (0, user_1.checkUsage)();
        if (usage.remaining <= 0) {
            this.setData({ showLimitDialog: true });
            return;
        }
        try {
            const res = await new Promise((resolve, reject) => {
                wx.chooseMedia({
                    count: 6,
                    mediaType: ["image"],
                    sourceType: ["album"],
                    sizeType: ["original"],
                    success: resolve,
                    fail: reject,
                    complete: () => {
                        // 选图界面关闭时（含左滑返回）确保可再次点击
                        if (this.data.isProcessing && !this.data.loading) {
                            this.setData({ isProcessing: false });
                        }
                    },
                });
            });
            const valErr = validateImageFiles(res.tempFiles);
            if (valErr) {
                wx.showToast({
                    title: valErr === "size" ? "图片不能超过4MB，请重新选择" : "仅支持 JPG/PNG 格式",
                    icon: "none",
                });
                return;
            }
            this.setData({ isProcessing: true });
            await this.handleMediaResult(res);
        }
        catch (e) {
            const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
            if (errMsg.includes("cancel"))
                return; // 用户主动取消，静默返回
            clearInterval(this.loadingTimer);
            this.setData({ loading: false });
            toast_1.default.fail(errMsg || "操作失败，请重试");
        }
        finally {
            this.setData({ isProcessing: false });
        }
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
    async onManualInputConfirm() {
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
        const usage = await (0, user_1.checkUsage)();
        if (usage.remaining <= 0) {
            this.setData({ showLimitDialog: true });
            return;
        }
        this.setData({ isProcessing: true });
        try {
            this.setData({
                loading: true,
                loadingEmoji: "📝",
                loadingBadge: "点菜顾问已就位",
                loadingText: "正在给这道菜补上好懂的介绍...",
            });
            const result = await (0, ai_1.recognizeManualDishes)(dishNames);
            this.setData({ loading: false });
            if (!result.recordId || (result.dishes?.length ?? 0) < 1) {
                toast_1.default.fail(result.error || "未识别到有效菜品");
                return;
            }
            const app = getApp();
            app.globalData.pendingRecord = {
                _id: result.recordId,
                _openid: "",
                imageFileID: "",
                dishes: result.dishes ?? [],
                status: "done",
                createdAt: new Date(),
            };
            wx.navigateTo({
                url: `/pages/menu-list/menu-list?recordId=${result.recordId}`,
            });
            (0, user_1.consumeUsage)().catch(() => { }); // 后台消耗，不阻塞跳转
        }
        catch (e) {
            this.setData({ loading: false });
            const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
            toast_1.default.fail(errMsg || "操作失败，请重试");
        }
        finally {
            this.setData({ isProcessing: false });
        }
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
    async handleMediaResult(res) {
        const files = res.tempFiles ?? [];
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
            // 压缩所有图片（偏小以控制 base64 体积，确保 callFunction 不超限）
            const compressedPaths = await Promise.all(filePaths.map(async (path) => {
                const c = await wx.compressImage({ src: path, quality: 40, compressedWidth: 800 });
                return c.tempFilePath;
            }));
            let recordId = null;
            let lastError = "";
            if (compressedPaths.length === 1) {
                const fs = wx.getFileSystemManager();
                const base64 = fs.readFileSync(compressedPaths[0], "base64");
                const useBase64 = base64.length <= BASE64_CALL_LIMIT;
                if (useBase64) {
                    const streamRes = await (0, ai_1.recognizeMenuBase64Stream)(base64);
                    recordId = streamRes.recordId ?? null;
                    if (streamRes.error)
                        lastError = streamRes.error;
                }
                else {
                    const fileID = await (0, ai_1.uploadImage)(compressedPaths[0]);
                    const streamRes = await (0, ai_1.recognizeMenuStream)(fileID);
                    recordId = streamRes.recordId ?? null;
                    if (streamRes.error)
                        lastError = streamRes.error;
                }
                if (recordId) {
                    if (useBase64) {
                        (0, ai_1.uploadImage)(compressedPaths[0]).then((fileID) => {
                            wx.cloud.database().collection("scan_records").doc(recordId).update({
                                data: { imageFileID: fileID },
                            }).catch(() => { });
                        }).catch(() => { });
                    }
                    const record = await this.pollForFirstDish(recordId);
                    clearInterval(this.loadingTimer);
                    this.setData({ loading: false });
                    const app = getApp();
                    app.globalData.pendingRecord = record;
                    wx.navigateTo({
                        url: `/pages/menu-list/menu-list?recordId=${recordId}`,
                    });
                    (0, user_1.consumeUsage)().catch(() => { });
                    return;
                }
                lastError = lastError || "识别服务启动失败，请重试";
            }
            else {
                // 多图：上传后走批量流式模式
                const fileIDs = await Promise.all(compressedPaths.map((path) => (0, ai_1.uploadImage)(path)));
                const batchRes = await (0, ai_1.recognizeMenuBatchStream)(fileIDs);
                recordId = batchRes.recordId ?? null;
                if (batchRes.error)
                    lastError = batchRes.error;
                if (recordId) {
                    const app = getApp();
                    app.globalData.pendingRecord = {
                        _id: recordId,
                        _openid: "",
                        imageFileID: fileIDs[0],
                        dishes: [],
                        partialDishes: [],
                        status: "processing",
                        createdAt: new Date(),
                    };
                    clearInterval(this.loadingTimer);
                    this.setData({ loading: false });
                    wx.navigateTo({
                        url: `/pages/menu-list/menu-list?recordId=${recordId}`,
                    });
                    (0, user_1.consumeUsage)().catch(() => { });
                    return;
                }
                else {
                    lastError = lastError || "识别服务启动失败，请重试";
                }
            }
            clearInterval(this.loadingTimer);
            this.setData({ loading: false });
            toast_1.default.fail(lastError || "识别失败，请重试");
        }
        catch (e) {
            console.error("recognition failed:", e);
            clearInterval(this.loadingTimer);
            this.setData({ loading: false });
            const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
            toast_1.default.fail(errMsg || "识别失败，请重试");
        }
    },
    /** 在加载页轮询，等首道菜出现或处理完成后返回记录 */
    pollForFirstDish(recordId) {
        return new Promise((resolve) => {
            const MAX_WAIT = 60000;
            const INTERVAL = 600;
            const start = Date.now();
            const check = async () => {
                try {
                    const record = await (0, history_1.getRecordById)(recordId);
                    if (record) {
                        const raw = record;
                        const partialCount = raw.partialDishes?.length ?? 0;
                        const dishCount = record.dishes?.length ?? 0;
                        const status = raw.status ?? "processing";
                        if (partialCount > 0 || dishCount > 0 || status === "done" || status === "error") {
                            // 透传 DB 原始字段，保留 menuTooLongHint、errorMessage 等
                            resolve(Object.assign({}, raw, { _id: recordId }));
                            return;
                        }
                    }
                }
                catch (_) { }
                if (Date.now() - start > MAX_WAIT) {
                    resolve({
                        _id: recordId,
                        _openid: "",
                        imageFileID: "",
                        dishes: [],
                        partialDishes: [],
                        status: "processing",
                        createdAt: new Date(),
                    });
                    return;
                }
                setTimeout(check, INTERVAL);
            };
            check();
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
    async onDeleteRecentRecord(e) {
        const ds = e.currentTarget.dataset;
        const recordId = (ds.recordId || ds.recordid || "");
        if (!recordId)
            return;
        const modalRes = await wx.showModal({
            title: "删除记录",
            content: "确认删除这条识别记录吗？删除后不可恢复。",
            confirmText: "删除",
            confirmColor: "#ee0a24",
            cancelText: "取消",
        });
        if (!modalRes.confirm)
            return;
        const ok = await (0, history_1.deleteRecordById)(recordId);
        if (!ok) {
            toast_1.default.fail("删除失败，请重试");
            return;
        }
        this.setData({
            recentRecords: this.data.recentRecords.filter((item) => item._id !== recordId),
        });
        toast_1.default.success("已删除");
    },
    onViewAllHistory() {
        wx.navigateTo({ url: "/pages/history/history" });
    },
    onLimitDialogConfirm() {
        this.setData({ showLimitDialog: false });
    },
    onLimitDialogCancel() {
        this.setData({ showLimitDialog: false });
    },
    /** 分享给朋友：+2 次 */
    onShareAppMessage() {
        (0, user_1.addShareBonus)(2).then((res) => {
            if (res.success) {
                (0, user_1.checkUsage)().then((usage) => {
                    this.setData({
                        remaining: usage.remaining,
                        total: usage.total,
                        canShare: usage.canShare,
                    });
                    toast_1.default.success("已获得 2 次额外机会");
                });
            }
            else {
                toast_1.default.fail("今日次数已达上限");
            }
        });
        return {
            title: "在国外不知道吃啥？拍一下菜单AI帮你搞懂每道菜",
            path: "/pages/index/index",
            imageUrl: "",
        };
    },
    /** 分享到朋友圈：+4 次 */
    onShareTimeline() {
        (0, user_1.addShareBonus)(4).then((res) => {
            if (res.success) {
                (0, user_1.checkUsage)().then((usage) => {
                    this.setData({
                        remaining: usage.remaining,
                        total: usage.total,
                        canShare: usage.canShare,
                    });
                    toast_1.default.success("已获得 4 次额外机会");
                });
            }
            else {
                toast_1.default.fail("今日次数已达上限");
            }
        });
        return {
            title: "在国外不知道吃啥？拍一下菜单AI帮你搞懂每道菜",
            query: "",
            imageUrl: "",
        };
    },
});
