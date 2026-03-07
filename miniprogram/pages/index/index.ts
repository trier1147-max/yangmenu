import Toast from "@vant/weapp/toast/toast";
import {
  recognizeMenu,
  recognizeManualDishes,
  recognizeMenuStream,
  saveRecord,
  uploadImage,
} from "../../services/ai";
import { deleteRecordById, getRecentRecords, getRecordById } from "../../services/history";
import type { Dish } from "../../utils/types";
import type { RecentRecordItem } from "../../services/history";

interface IndexData {
  recentRecords: RecentRecordItem[];
  loading: boolean;
  loadingEmoji?: string;
  loadingBadge?: string;
  loadingText?: string;
  showManualInput: boolean;
  manualInputText: string;
}

Page({
  data: {
    recentRecords: [] as RecentRecordItem[],
    loading: false,
    loadingEmoji: "👨‍🍳",
    loadingBadge: "菜单小剧场",
    loadingText: "识别中...",
    showManualInput: false,
    manualInputText: "",
  } as IndexData,

  loadingTimer: 0 as number,

  onShow() {
    this.refreshData();
  },

  async refreshData() {
    const recentRecords = await getRecentRecords(3);
    this.setData({ recentRecords });
  },

  /** 轮询直到解析出至少一道菜，或识别完成/报错/超时 */
  async waitForAtLeastOneDish(
    recordId: string,
    timeoutMs = 35000
  ): Promise<{ hasDish: boolean; errorMessage?: string }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const record = await getRecordById(recordId);
      if (record) {
        const count = (record.partialDishes?.length ?? 0) || (record.dishes?.length ?? 0);
        if (count > 0) return { hasDish: true };
        if (record.status === "done" || record.status === "error") {
          const err = (record as { errorMessage?: string }).errorMessage;
          return { hasDish: false, errorMessage: err };
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    return { hasDish: false };
  },

  async onTakePhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 6,
        mediaType: ["image"],
        sourceType: ["camera"],
      });
      await this.handleMediaResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("cancel")) return; // 用户主动取消，静默返回
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      Toast.fail(msg || "选择失败，请重试");
    }
  },

  async onChooseAlbum() {
    try {
      const res = await wx.chooseMedia({
        count: 6,
        mediaType: ["image"],
        sourceType: ["album"],
      });
      await this.handleMediaResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("cancel")) return; // 用户主动取消，静默返回
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      Toast.fail(msg || "选择失败，请重试");
    }
  },

  onManualInput() {
    this.setData({ showManualInput: true, manualInputText: "" });
  },

  onManualInputChange(e: WechatMiniprogram.Input) {
    this.setData({ manualInputText: e.detail.value });
  },

  onManualInputClose() {
    this.setData({ showManualInput: false, manualInputText: "" });
  },

  onManualInputCancel() {
    this.setData({ showManualInput: false, manualInputText: "" });
  },

  async onManualInputConfirm() {
    const text = (this.data.manualInputText || "").trim();
    this.setData({ showManualInput: false, manualInputText: "" });

    if (!text) {
      Toast("请至少输入一个菜名");
      return;
    }

    const dishNames = this.parseManualNames(text);
    if (dishNames.length === 0) {
      Toast("未识别到有效菜名");
      return;
    }

    this.setData({
      loading: true,
      loadingEmoji: "📝",
      loadingBadge: "点菜顾问已就位",
      loadingText: "正在给这道菜补上好懂的介绍...",
    });

    try {
      const result = await recognizeManualDishes(dishNames);
      this.setData({ loading: false });

      if (!result.recordId || (result.dishes?.length ?? 0) < 1) {
        Toast.fail(result.error || "未识别到有效菜品");
        return;
      }

      wx.navigateTo({
        url: `/pages/menu-list/menu-list?recordId=${result.recordId}`,
      });
    } catch (e) {
      this.setData({ loading: false });
      const msg = e instanceof Error ? e.message : String(e);
      Toast.fail(msg || "保存失败，请重试");
    }
  },

  /** 解析手动输入的菜名，支持中英文逗号、分号、顿号、换行分隔 */
  parseManualNames(text: string): string[] {
    const normalized = text.replace(/[\r\t]/g, " ");
    // 中英文逗号(，,)、分号(；;)、顿号(、)均可分隔
    const parts = normalized
      .split(/[\n,;\uFF0C\uFF1B\u3001]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 40);

    const seen = new Set<string>();
    const names: string[] = [];

    parts.forEach((name) => {
      if (seen.has(name)) return;
      seen.add(name);
      names.push(name);
    });
    return names;
  },

  async handleMediaResult(
    res: WechatMiniprogram.ChooseMediaSuccessCallbackResult
  ) {
    const files = res.tempFiles ?? [];
    if (files.length === 0) return;

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
      } else if (timeElapsed >= 7) {
        this.setData({
          loadingEmoji: "🍽️",
          loadingBadge: "准备上桌",
          loadingText: "菜品马上整理好，稍等一下...",
        });
      }
    }, 3000) as unknown as number;

    try {
      const filePaths = files.map((f) => f.tempFilePath);
      const compressed = await Promise.all(
        filePaths.map((path) =>
          wx.compressImage({
            src: path,
            quality: 50,
            compressedWidth: 960,
          })
        )
      );
      const fileIDs = await Promise.all(
        compressed.map((c) => uploadImage(c.tempFilePath))
      );

      const allDishes: Dish[] = [];
      let recordId: string | null = null;
      let lastError = "";

      if (fileIDs.length === 1) {
        const streamRes = await recognizeMenuStream(fileIDs[0]);
        recordId = streamRes.recordId ?? null;
        if (streamRes.error) lastError = streamRes.error;
        if (recordId) {
          const { hasDish, errorMessage } = await this.waitForAtLeastOneDish(recordId);
          if (!hasDish) {
            recordId = null;
            lastError = errorMessage || lastError || "未识别到有效菜品";
          }
        } else {
          lastError = lastError || "识别服务启动失败，请重试";
        }
      } else {
        const results = await Promise.all(
          fileIDs.map((fileID) => recognizeMenu(fileID, false))
        );
        results.forEach((r) => {
          r.dishes.forEach((d) => allDishes.push(d));
          if (r.error) lastError = r.error;
        });
        if (allDishes.length > 0) {
          recordId = await saveRecord(fileIDs[0], allDishes);
        } else {
          lastError = lastError || "未识别到有效菜品";
        }
      }

      clearInterval(this.loadingTimer);
      this.setData({ loading: false });

      if (recordId) {
        wx.navigateTo({
          url: `/pages/menu-list/menu-list?recordId=${recordId}`,
        });
      } else {
        Toast.fail(lastError || "识别失败，请重试");
      }
    } catch (e) {
      console.error("recognition failed:", e);
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      const msg = e instanceof Error ? e.message : String(e);
      Toast.fail(msg || "识别失败，请重试");
    }
  },

  onRecordTap(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset as { recordId?: string; recordid?: string };
    const recordId = (ds.recordId || ds.recordid || "") as string;
    if (recordId) {
      wx.navigateTo({
        url: `/pages/menu-list/menu-list?recordId=${recordId}`,
      });
    }
  },

  async onDeleteRecentRecord(e: WechatMiniprogram.TouchEvent) {
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
      recentRecords: this.data.recentRecords.filter((item) => item._id !== recordId),
    });
    Toast.success("已删除");
  },

  onViewAllHistory() {
    wx.navigateTo({ url: "/pages/history/history" });
  },
});
