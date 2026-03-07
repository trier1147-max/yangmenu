"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
App({
    globalData: {
        openid: "",
        userInfo: null,
        initPromise: Promise.resolve(),
        pendingRecord: null,
    },
    onLaunch() {
        if (!wx.cloud) {
            console.error("请使用 2.2.3 或以上的基础库以使用云能力");
            return;
        }
        wx.cloud.init({
            env: "cloud1-0gdbdassd6ca82d8",
            traceUser: true,
        });
        this.globalData.initPromise = this.initUser();
    },
    /** 应用回到前台时，若首页在等待选图（左滑返回不会触发 Page.onShow），在此兜底重置 */
    onShow() {
        const pages = getCurrentPages();
        const cur = pages[pages.length - 1];
        if (cur?.route === "pages/index/index") {
            const d = cur.data;
            if (d?.isProcessing && !d?.loading) {
                cur.setData({ isProcessing: false });
            }
        }
    },
    async initUser() {
        try {
            await wx.login();
            const res = await wx.cloud.callFunction({
                name: "getUserInfo",
                data: {},
            });
            const result = res.result;
            if (result?.openid && result?.user) {
                this.globalData.openid = result.openid;
                this.globalData.userInfo = result.user;
            }
        }
        catch (e) {
            console.error("initUser failed:", e);
        }
    },
});
