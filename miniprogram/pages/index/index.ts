import Toast from "@vant/weapp/toast/toast";
import type { AppOption } from "../../app";
import {
  recognizeMenu,
  recognizeManualDishes,
  recognizeMenuStream,
  saveRecord,
  uploadImage,
} from "../../services/ai";
import { deleteRecordById, getRecentRecords } from "../../services/history";
import { checkUsage, consumeUsage, addShareBonus } from "../../services/user";
import type { Dish } from "../../utils/types";
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
  remaining: number;
  total: number;
  canShare: boolean;
  showLimitDialog: boolean;
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
    remaining: 6,
    total: 6,
    canShare: true,
    showLimitDialog: false,
  } as IndexData,

  loadingTimer: 0 as number,

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
      getRecentRecords(3),
      checkUsage(),
    ]);
    this.setData({
      recentRecords,
      remaining: usage.remaining,
      total: usage.total,
      canShare: usage.canShare,
    });
  },

  async onTakePhoto() {
    if (this.data.isProcessing) return;
    const usage = await checkUsage();
    if (usage.remaining <= 0) {
      this.setData({ showLimitDialog: true });
      return;
    }
    try {
      const res = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>(
        (resolve, reject) => {
          wx.chooseMedia({
            count: 6,
            mediaType: ["image"],
            sourceType: ["camera"],
            success: resolve,
            fail: reject,
            complete: () => {
              // 选图界面关闭时（含左滑返回）确保可再次点击
              if (this.data.isProcessing && !this.data.loading) {
                this.setData({ isProcessing: false });
              }
            },
          });
        }
      );
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
    const usage = await checkUsage();
    if (usage.remaining <= 0) {
      this.setData({ showLimitDialog: true });
      return;
    }
    try {
      const res = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>(
        (resolve, reject) => {
          wx.chooseMedia({
            count: 6,
            mediaType: ["image"],
            sourceType: ["album"],
            success: resolve,
            fail: reject,
            complete: () => {
              // 选图界面关闭时（含左滑返回）确保可再次点击
              if (this.data.isProcessing && !this.data.loading) {
                this.setData({ isProcessing: false });
              }
            },
          });
        }
      );
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

    const usage = await checkUsage();
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
      consumeUsage().catch(() => {}); // 后台消耗，不阻塞跳转
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
          // 妙招：拿到 recordId 后立即跳转详情页，不再在加载页等待首道菜
          // 详情页会轮询展示流式菜品，用户能更快看到结果页
          const app = getApp() as AppOption;
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
          consumeUsage().catch(() => {});
          return; // 提前返回，不进入后续逻辑
        } else {
          lastError = lastError || "识别服务启动失败，请重试";
        }
      } else {
        // 并行识别，Promise.all 按 fileIDs 顺序返回，保证菜品顺序与用户选择图片顺序一致
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
        consumeUsage().catch(() => {}); // 后台消耗，不阻塞跳转
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

  onLimitDialogConfirm() {
    this.setData({ showLimitDialog: false });
  },

  onLimitDialogCancel() {
    this.setData({ showLimitDialog: false });
  },

  /** 分享给朋友：+2 次 */
  onShareAppMessage() {
    addShareBonus(2).then((res) => {
      if (res.success) {
        checkUsage().then((usage) => {
          this.setData({
            remaining: usage.remaining,
            total: usage.total,
            canShare: usage.canShare,
          });
          Toast.success("已获得 2 次额外机会");
        });
      } else {
        Toast.fail("今日次数已达上限");
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
    addShareBonus(4).then((res) => {
      if (res.success) {
        checkUsage().then((usage) => {
          this.setData({
            remaining: usage.remaining,
            total: usage.total,
            canShare: usage.canShare,
          });
          Toast.success("已获得 4 次额外机会");
        });
      } else {
        Toast.fail("今日次数已达上限");
      }
    });
    return {
      title: "在国外不知道吃啥？拍一下菜单AI帮你搞懂每道菜",
      query: "",
      imageUrl: "",
    };
  },
});
