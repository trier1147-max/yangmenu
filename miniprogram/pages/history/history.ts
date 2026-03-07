import Toast from "@vant/weapp/toast/toast";
import { deleteRecordById, getRecentRecords } from "../../services/history";
import type { RecentRecordItem } from "../../services/history";

Page({
  data: {
    list: [] as RecentRecordItem[],
  },

  onShow() {
    this.loadHistory();
  },

  async loadHistory() {
    const list = await getRecentRecords(50);
    this.setData({ list });
  },

  onRecordTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { recordId?: string; recordid?: string };
    const recordId = (ds.recordId || ds.recordid || "") as string;
    if (recordId) {
      wx.navigateTo({
        url: `/pages/menu-list/menu-list?recordId=${recordId}&from=history`,
      });
    }
  },

  async onDeleteRecord(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { recordId?: string; recordid?: string };
    const recordId = (ds.recordId || ds.recordid || "") as string;
    if (!recordId) return;

    const modalRes = await wx.showModal({
      title: "删除记录",
      content: "确认删除这条识别记录吗？删除后不可恢复。",
      confirmText: "删除",
      confirmColor: "#ee0a24",
      cancelText: "取消",
    });
    if (!modalRes.confirm) return;

    const ok = await deleteRecordById(recordId);
    if (!ok) {
      Toast.fail("删除失败，请重试");
      return;
    }

    this.setData({
      list: this.data.list.filter((item) => item._id !== recordId),
    });
    Toast.success("已删除");
  },
});
