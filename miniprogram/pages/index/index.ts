import Toast from "@vant/weapp/toast/toast";
import type { AppOption } from "../../app";
import {
  recognizeMenu,
  recognizeManualDishes,
  recognizeMenuStream,
  saveRecord,
  uploadImage,
} from "../../services/ai";
import { consumeDailyUsage } from "../../services/cloud";
import { deleteRecordById, getRecentRecords, getRecordById } from "../../services/history";
import type { Dish, ScanRecord } from "../../utils/types";
import type { RecentRecordItem } from "../../services/history";

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"];

interface IndexData {
  recentRecords: RecentRecordItem[];
  loading: boolean;
  loadingEmoji?: string;
  loadingBadge?: string;
  loadingText?: string;
  showManualInput: boolean;
  manualInputText: string;
  isProcessing: boolean;
}

/** Validate image files: size <= 4MB, format jpg/jpeg/png. Returns error message or null if valid. */
function validateImageFiles(
  files: WechatMiniprogram.ChooseMediaSuccessCallbackResult["tempFiles"]
): string | null {
  if (!files || files.length === 0) return null;
  for (const f of files) {
    const size = f.size ?? 0;
    if (size > MAX_IMAGE_SIZE_BYTES) {
      return "size";
    }
    const path = f.tempFilePath || "";
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const hasExtension = path.includes(".") && ext.length > 0;
    if (hasExtension) {
      if (!ALLOWED_EXTENSIONS.includes(ext)) return "format";
    } else {
      if (f.fileType !== "image") return "format";
    }
  }
  return null;
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
    isProcessing: false,
  } as IndexData,

  loadingTimer: 0 as number,

  onShow() {
    this.refreshData();
  },

  async refreshData() {
    const recentRecords = await getRecentRecords(3);
    this.setData({ recentRecords });
  },

  /** 轮询直到解析出至少一道菜，或识别完成/报错/超时。成功时返回 record 供跳转页直接使用，避免二次请求。 */
  async waitForAtLeastOneDish(
    recordId: string,
    timeoutMs = 35000
  ): Promise<{ hasDish: boolean; errorMessage?: string; record?: ScanRecord & { _id: string } }> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const record = await getRecordById(recordId);
      if (record) {
        const count = (record.partialDishes?.length ?? 0) || (record.dishes?.length ?? 0);
        if (count > 0) {
          const full = record as ScanRecord & { _id: string };
          return { hasDish: true, record: Object.assign({}, full, { _id: recordId }) };
        }
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
    if (this.data.isProcessing) return;
    this.setData({ isProcessing: true });
    try {
      const res = await wx.chooseMedia({
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
      const usageResult = await consumeDailyUsage();
      if (usageResult.success && usageResult.canProceed) {
        await this.handleMediaResult(res);
      } else if (usageResult.success && !usageResult.canProceed) {
        wx.showModal({
          title: "今日次数已用完",
          content: "每日可免费识别 6 次，明天再来吧！",
          showCancel: false,
        });
      } else {
        wx.showToast({
          title: "网络异常，请检查网络后重试",
          icon: "none",
          duration: 2000,
        });
      }
    } catch (e: any) {
      const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
      if (errMsg.includes("cancel")) return; // 用户主动取消，静默返回
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      Toast.fail(errMsg || "操作失败，请重试");
    } finally {
      this.setData({ isProcessing: false });
    }
  },

  async onChooseAlbum() {
    if (this.data.isProcessing) return;
    this.setData({ isProcessing: true });
    try {
      const res = await wx.chooseMedia({
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
      const usageResult = await consumeDailyUsage();
      if (usageResult.success && usageResult.canProceed) {
        await this.handleMediaResult(res);
      } else if (usageResult.success && !usageResult.canProceed) {
        wx.showModal({
          title: "今日次数已用完",
          content: "每日可免费识别 6 次，明天再来吧！",
          showCancel: false,
        });
      } else {
        wx.showToast({
          title: "网络异常，请检查网络后重试",
          icon: "none",
          duration: 2000,
        });
      }
    } catch (e: any) {
      const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
      if (errMsg.includes("cancel")) return; // 用户主动取消，静默返回
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      Toast.fail(errMsg || "操作失败，请重试");
    } finally {
      this.setData({ isProcessing: false });
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
    if (this.data.isProcessing) return;
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

    this.setData({ isProcessing: true });
    try {
      const usageResult = await consumeDailyUsage();
      if (usageResult.success && usageResult.canProceed) {
        // proceed
      } else if (usageResult.success && !usageResult.canProceed) {
        wx.showModal({
          title: "今日次数已用完",
          content: "每日可免费识别 6 次，明天再来吧！",
          showCancel: false,
        });
        return;
      } else {
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

      const result = await recognizeManualDishes(dishNames);
      this.setData({ loading: false });

      if (!result.recordId || (result.dishes?.length ?? 0) < 1) {
        Toast.fail(result.error || "未识别到有效菜品");
        return;
      }

      const app = getApp() as AppOption;
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
    } catch (e: any) {
      this.setData({ loading: false });
      const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
      Toast.fail(errMsg || "操作失败，请重试");
    } finally {
      this.setData({ isProcessing: false });
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
          const { hasDish, errorMessage, record } = await this.waitForAtLeastOneDish(recordId);
          if (!hasDish) {
            recordId = null;
            lastError = errorMessage || lastError || "未识别到有效菜品";
          } else if (record) {
            (getApp() as AppOption).globalData.pendingRecord = record;
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
          if (recordId) {
            const app = getApp() as AppOption;
            app.globalData.pendingRecord = {
              _id: recordId,
              _openid: "",
              imageFileID: fileIDs[0],
              dishes: allDishes,
              status: "done",
              createdAt: new Date(),
            };
          }
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
    } catch (e: any) {
      console.error("recognition failed:", e);
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
      Toast.fail(errMsg || "识别失败，请重试");
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
