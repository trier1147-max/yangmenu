"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const toast_1 = __importDefault(require("@vant/weapp/toast/toast"));
const history_1 = require("../../services/history");
Page({
    data: {
        list: [],
    },
    onShow() {
        this.loadHistory();
    },
    async loadHistory() {
        const list = await (0, history_1.getRecentRecords)(50);
        this.setData({ list });
    },
    onRecordTap(e) {
        const ds = e.currentTarget.dataset;
        const recordId = (ds.recordId || ds.recordid || "");
        if (recordId) {
            wx.navigateTo({
                url: `/pages/menu-list/menu-list?recordId=${recordId}&from=history`,
            });
        }
    },
    async onDeleteRecord(e) {
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
            list: this.data.list.filter((item) => item._id !== recordId),
        });
        toast_1.default.success("已删除");
    },
});
