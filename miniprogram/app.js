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
    initUser() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield wx.login();
                const res = yield wx.cloud.callFunction({
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
        });
    },
});
