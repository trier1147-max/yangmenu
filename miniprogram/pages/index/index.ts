import Toast from "@vant/weapp/toast/toast";
import type { AppOption } from "../../app";
import {
  recognizeManualDishes,
  recognizeMenuBase64Stream,
  recognizeMenuStream,
  uploadImage,
} from "../../services/ai";
import { isDataExceedMaxSizeError } from "../../services/cloud";
import { deleteRecordById, getRecentRecords } from "../../services/history";
import { checkUsage, consumeUsage, addShareBonus } from "../../services/user";
import type { RecentRecordItem } from "../../services/history";

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png"];
/**
 * base64 路径：仅对极小图片（≤20K chars ≈ 15KB binary）启用，省去云存储上传耗时。
 * 20K 是非常保守的阈值——远低于之前导致网关拦截的大小，几乎不会触发 callFunction 超限。
 * 超过阈值的图片（绝大多数）自动走上传路径，保持稳定性。
 */
const SKIP_BASE64_PATH = false;
const BASE64_CALL_LIMIT = 30_000;

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
  console.log("[DEBUG] validateImageFiles called, files:", files?.length);
  if (!files || files.length === 0) return null;
  for (const f of files) {
    const size = f.size ?? 0;
    const path = f.tempFilePath || "";
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    console.log(`[DEBUG] Validating file: size=${size}B, path=${path}, ext=${ext}, fileType=${f.fileType}`);

    if (size > MAX_IMAGE_SIZE_BYTES) {
      console.log("[DEBUG] Validation failed: size too large");
      return "size";
    }
    const hasExtension = path.includes(".") && ext.length > 0;
    if (hasExtension) {
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        console.log("[DEBUG] Validation failed: invalid extension");
        return "format";
      }
    } else {
      if (f.fileType !== "image") {
        console.log("[DEBUG] Validation failed: not an image");
        return "format";
      }
    }
  }
  console.log("[DEBUG] Validation passed");
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
            count: 1,
            mediaType: ["image"],
            sourceType: ["camera"],
            sizeType: ["compressed"],
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
    console.log("[DEBUG] onChooseAlbum called");
    if (this.data.isProcessing) return;
    const usage = await checkUsage();
    if (usage.remaining <= 0) {
      this.setData({ showLimitDialog: true });
      return;
    }
    try {
      console.log("[DEBUG] Starting wx.chooseMedia");
      const res = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>(
        (resolve, reject) => {
          wx.chooseMedia({
            count: 1,
            mediaType: ["image"],
            sourceType: ["album"],
            sizeType: ["compressed"],
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
      console.log("[DEBUG] Image selected from album, count:", res.tempFiles?.length);
      const valErr = validateImageFiles(res.tempFiles);
      console.log("[DEBUG] Album validation result:", valErr || "passed");
      if (valErr) {
        wx.showToast({
          title: valErr === "size" ? "图片不能超过4MB，请重新选择" : "仅支持 JPG/PNG 格式",
          icon: "none",
        });
        return;
      }
      this.setData({ isProcessing: true });
      console.log("[DEBUG] Calling handleMediaResult for album");
      await this.handleMediaResult(res);
    } catch (e: any) {
      console.error("[DEBUG] onChooseAlbum error:", e);
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
    console.log("[DEBUG] === handleMediaResult START ===");
    const files = res.tempFiles ?? [];
    console.log("[DEBUG] Files count:", files.length);
    if (files.length === 0) {
      console.log("[DEBUG] No files, returning");
      return;
    }

    console.log("[DEBUG] Setting loading state");
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

      // 压缩所有图片（偏小以控制 base64 体积，确保 callFunction 不超限）
      const compressedPaths = await Promise.all(
        filePaths.map(async (path) => {
          try {
            // quality:25 + width:700 上传体积更小，对 OCR 识别率无显著影响
            const c = await wx.compressImage({
              src: path,
              quality: 25,
              compressedWidth: 700,
            });
            return c.tempFilePath;
          } catch (e: any) {
            // 降级：如果 compressedWidth 不支持，只用 quality 压缩
            console.warn("[DEBUG] compressImage with width failed, fallback:", e);
            try {
              const c = await wx.compressImage({ src: path, quality: 25 });
              return c.tempFilePath;
            } catch (e2) {
              console.error("[DEBUG] Compression failed, using original:", e2);
              return path;
            }
          }
        })
      );

      let recordId: string | null = null;
      let lastError = "";
      let base64: string | null = null;

      {
        let useBase64 = false;

        // base64 路径：仅对极小图片尝试，网关拦截风险极低；失败则静默回落上传
        if (!SKIP_BASE64_PATH) {
          try {
            const fs = wx.getFileSystemManager();
            base64 = fs.readFileSync(compressedPaths[0], "base64") as string;
            if (base64.length <= BASE64_CALL_LIMIT) {
              console.log(`[DEBUG] base64路径：${base64.length} chars，尝试跳过上传`);
              const streamRes = await recognizeMenuBase64Stream(base64);
              if (streamRes.recordId) {
                recordId = streamRes.recordId;
                useBase64 = true;
              }
            } else {
              console.log(`[DEBUG] base64太大(${base64.length} > ${BASE64_CALL_LIMIT})，走上传路径`);
            }
          } catch (_) {}
        }

        // 上传路径：上传到云存储后 callFunction 只传 fileID
        if (!recordId) {
          console.log("[DEBUG] 走上传路径");
          const uploadStartTime = Date.now();
          try {
            const fileID = await uploadImage(compressedPaths[0]);
            const uploadDuration = Date.now() - uploadStartTime;
            console.log(`[DEBUG] 📤 Upload success in ${uploadDuration}ms, fileID:`, fileID);

            const callStartTime = Date.now();
            const streamRes = await recognizeMenuStream(fileID);
            const callDuration = Date.now() - callStartTime;

            recordId = streamRes.recordId ?? null;
            if (streamRes.recordId) {
              console.log(`[DEBUG] ✅ Upload path SUCCESS (call took ${callDuration}ms)`);
            } else {
              console.error(`[DEBUG] ❌ Upload path FAILED after ${callDuration}ms:`, streamRes.error);
            }
            if (streamRes.error) lastError = streamRes.error;
          } catch (e: any) {
            const totalDuration = Date.now() - uploadStartTime;
            console.error(`[DEBUG] ❌ Upload path EXCEPTION after ${totalDuration}ms:`, e?.errMsg || e?.message || e);
            console.error("[DEBUG] 📋 Full error object:", e);
            lastError = e?.errMsg || e?.message || "Upload failed";
          }
        }

        if (recordId) {
          console.log("[DEBUG] 🎉 SUCCESS! RecordId:", recordId);
          console.log(`[DEBUG] 📊 Final path used: ${useBase64 ? 'Base64' : 'Upload'}`);

          // base64 路径：entry 不保存 imageFileID，后台补传
          if (useBase64) {
            uploadImage(compressedPaths[0]).then((fileID) => {
              console.log("[DEBUG] 📤 Background upload completed:", fileID);
              wx.cloud.database().collection("scan_records").doc(recordId!).update({
                data: { imageFileID: fileID },
              }).catch(() => {});
            }).catch(() => {});
          }

          // 立即跳转，让详情页轮询展示流式菜品
          clearInterval(this.loadingTimer);
          this.setData({ loading: false });

          const app = getApp() as AppOption;
          app.globalData.pendingRecord = {
            _id: recordId,
            _openid: "",
            imageFileID: "",
            dishes: [],
            partialDishes: [],
            status: "processing",
            createdAt: new Date(),
          };
          wx.navigateTo({
            url: `/pages/menu-list/menu-list?recordId=${recordId}`,
          });
          consumeUsage().catch(() => {});
          return;
        }
        lastError = lastError || "识别服务启动失败，请重试";
      }

      console.error("[DEBUG] ❌❌❌ FINAL FAILURE - No recordId obtained");
      console.error(`[DEBUG] 📋 Last error: ${lastError}`);
      console.error("[DEBUG] 💡 All paths failed. Check logs above for details.");
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      // 展示更具体的错误，便于排查；若为 callFunction 超限，提示用户换小图
      const userMsg =
        lastError.includes("cloud.callFunction") || isDataExceedMaxSizeError(lastError)
          ? "图片过大或网络不稳定，请换一张较小的图片重试"
          : lastError || "识别失败，请重试";
      Toast.fail(userMsg);
    } catch (e: any) {
      console.error("[DEBUG] ❌ Exception caught in handleMediaResult:", e);
      console.error("[DEBUG] 📋 Exception type:", typeof e);
      console.error("[DEBUG] 📋 Exception details:", JSON.stringify(e, null, 2));
      clearInterval(this.loadingTimer);
      this.setData({ loading: false });
      const errMsg = e?.errMsg || e?.message || (typeof e === "string" ? e : "");
      console.error("[DEBUG] 📋 Final error shown to user:", errMsg);
      const userMsg =
        errMsg.includes("cloud.callFunction") || isDataExceedMaxSizeError(errMsg)
          ? "图片过大或网络不稳定，请换一张较小的图片重试"
          : errMsg || "识别失败，请重试";
      Toast.fail(userMsg);
    } finally {
      console.log("[DEBUG] === handleMediaResult END ===");
      this.setData({ isProcessing: false });
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
