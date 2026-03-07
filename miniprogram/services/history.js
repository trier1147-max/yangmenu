"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordById = getRecordById;
exports.deleteRecordById = deleteRecordById;
exports.getRecentRecords = getRecentRecords;
/** 根据 recordId 获取单条扫描记录 */
async function getRecordById(recordId) {
    if (!recordId)
        return null;
    try {
        const db = wx.cloud.database();
        const res = await db.collection("scan_records").doc(recordId).get();
        return res.data ?? null;
    }
    catch (e) {
        console.error("getRecordById failed:", e);
        return null;
    }
}
/** 根据 recordId 删除单条扫描记录 */
async function deleteRecordById(recordId) {
    if (!recordId)
        return false;
    try {
        const db = wx.cloud.database();
        await db.collection("scan_records").doc(recordId).remove();
        return true;
    }
    catch (e) {
        console.error("deleteRecordById failed:", e);
        return false;
    }
}
/** 获取最近 N 条扫描记录 */
async function getRecentRecords(limit = 3) {
    try {
        const db = wx.cloud.database();
        const res = await db
            .collection("scan_records")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        const list = res.data.map((r) => {
            const dishesForDisplay = r.dishes ?? r.partialDishes ?? [];
            return {
                _id: r._id,
                createdAt: r.createdAt,
                timeText: formatTime(r.createdAt),
                dishSummary: dishesForDisplay
                    .slice(0, 3)
                    .map((d) => d.briefCN || d.originalName)
                    .filter(Boolean)
                    .join("、") || "无菜品",
                dishCount: dishesForDisplay.length,
                imageFileID: r.imageFileID || "",
            };
        });
        return list;
    }
    catch (e) {
        console.error("getRecentRecords failed:", e);
        return [];
    }
}
function formatTime(date) {
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000)
        return "刚刚";
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000)
        return `${Math.floor(diff / 3600000)}小时前`;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
