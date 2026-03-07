"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordById = getRecordById;
exports.deleteRecordById = deleteRecordById;
exports.getRecentRecords = getRecentRecords;
/** 鏍规嵁 recordId 鑾峰彇鍗曟潯鎵弿璁板綍 */
async function getRecordById(recordId) {
    var _a;
    if (!recordId)
        return null;
    try {
        const db = wx.cloud.database();
        const res = await db.collection("scan_records").doc(recordId).get();
        return (_a = res.data) !== null && _a !== void 0 ? _a : null;
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
/** 鑾峰彇鏈€杩?N 鏉℃壂鎻忚褰?*/
async function getRecentRecords(limit = 3) {
    try {
        const db = wx.cloud.database();
        const res = await db
            .collection("scan_records")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();
        const list = res.data.map((r) => {
            var _a;
            return ({
                _id: r._id,
                createdAt: r.createdAt,
                timeText: formatTime(r.createdAt),
                dishSummary: ((_a = r.dishes) !== null && _a !== void 0 ? _a : [])
                    .slice(0, 3)
                    .map((d) => d.briefCN || d.originalName)
                    .filter(Boolean)
                    .join("銆?) || "鏃犺彍鍝?,
            });
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
        return "鍒氬垰";
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)}鍒嗛挓鍓峘;
    if (diff < 86400000)
        return `${Math.floor(diff / 3600000)}灏忔椂鍓峘;
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
