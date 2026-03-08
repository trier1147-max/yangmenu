// 洋菜单 - 扫描历史服务，查询最近记录
import type { ScanRecord } from "../utils/types";

/** 根据 recordId 获取单条扫描记录 */
export async function getRecordById(
  recordId: string
): Promise<ScanRecord | null> {
  if (!recordId) return null;
  try {
    const db = wx.cloud.database();
    const res = await db.collection("scan_records").doc(recordId).get();
    return (res.data as ScanRecord) ?? null;
  } catch (e) {
    console.error("getRecordById failed:", e);
    return null;
  }
}

/** 根据 recordId 删除单条扫描记录 */
export async function deleteRecordById(recordId: string): Promise<boolean> {
  if (!recordId) return false;
  try {
    const db = wx.cloud.database();
    await db.collection("scan_records").doc(recordId).remove();
    return true;
  } catch (e) {
    console.error("deleteRecordById failed:", e);
    return false;
  }
}

/** 最近扫描记录展示项 */
export interface RecentRecordItem {
  _id: string;
  createdAt: Date;
  timeText: string;
  dishSummary: string;
  dishCount: number;
  imageFileID?: string;
}

/** 获取最近 N 条扫描记录 */
export async function getRecentRecords(
  limit: number = 3
): Promise<RecentRecordItem[]> {
  try {
    const db = wx.cloud.database();
    const res = await db
      .collection("scan_records")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const list = (res.data as ScanRecord[]).map((r) => {
      const raw = r as ScanRecord & { _id: string };
      const dishesForDisplay = raw.dishes ?? raw.partialDishes ?? [];
      return {
        _id: raw._id,
        createdAt: r.createdAt,
        timeText: formatTime(r.createdAt),
        dishSummary: dishesForDisplay
          .slice(0, 3)
          .map((d) => d.originalName || d.briefCN)
          .filter(Boolean)
          .join("、") || "无菜品",
        dishCount: dishesForDisplay.length,
        imageFileID: r.imageFileID || "",
      };
    });
    return list;
  } catch (e) {
    console.error("getRecentRecords failed:", e);
    return [];
  }
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
