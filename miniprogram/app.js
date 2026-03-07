"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
App({
    globalData: {
        openid: "",
        userInfo: null,
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
        this.initUser();
    },
    async initUser() {
        try {
            await wx.login();
            const res = await wx.cloud.callFunction({
                name: "getUserInfo",
                data: {},
            });
            const result = res.result;
            if ((result === null || result === void 0 ? void 0 : result.openid) && (result === null || result === void 0 ? void 0 : result.user)) {
                this.globalData.openid = result.openid;
                this.globalData.userInfo = result.user;
            }
        }
        catch (e) {
            console.error("initUser failed:", e);
        }
    },
});
