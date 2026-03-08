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

  async onClearAll() {
    const modalRes = await wx.showModal({
      title: "清空所有记录",
      content: "将删除数据库中全部 scan_records，不可恢复。确认继续？",
      confirmText: "清空",
      confirmColor: "#ee0a24",
      cancelText: "取消",
    });
    if (!modalRes.confirm) return;

    Toast.loading({ message: "清空中…", duration: 0 });
    try {
      const res = await wx.cloud.callFunction({
        name: "clearScanRecords",
        data: { confirm: true },
      });
      const result = res.result as { success?: boolean; totalDeleted?: number; error?: string };
      Toast.clear();
      if (result.success) {
        this.setData({ list: [] });
        Toast.success(`已清空 ${result.totalDeleted ?? 0} 条记录`);
      } else {
        Toast.fail(result.error || "清空失败");
      }
    } catch (e: unknown) {
      Toast.clear();
      Toast.fail((e as Error).message || "清空失败");
    }
  },
});
