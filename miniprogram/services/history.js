"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecordById = getRecordById;
exports.deleteRecordById = deleteRecordById;
exports.getRecentRecords = getRecentRecords;
/** 根据 recordId 获取单条扫描记录 */
function getRecordById(recordId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!recordId)
            return null;
        try {
            const db = wx.cloud.database();
            const res = yield db.collection("scan_records").doc(recordId).get();
            return (_a = res.data) !== null && _a !== void 0 ? _a : null;
        }
        catch (e) {
            console.error("getRecordById failed:", e);
            return null;
        }
    });
}
/** 根据 recordId 删除单条扫描记录 */
function deleteRecordById(recordId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!recordId)
            return false;
        try {
            const db = wx.cloud.database();
            yield db.collection("scan_records").doc(recordId).remove();
            return true;
        }
        catch (e) {
            console.error("deleteRecordById failed:", e);
            return false;
        }
    });
}
/** 获取最近 N 条扫描记录 */
function getRecentRecords() {
    return __awaiter(this, arguments, void 0, function* (limit = 3) {
        try {
            const db = wx.cloud.database();
            const res = yield db
                .collection("scan_records")
                .orderBy("createdAt", "desc")
                .limit(limit)
                .get();
            const list = res.data.map((r) => {
                var _a, _b;
                return ({
                    _id: r._id,
                    createdAt: r.createdAt,
                    timeText: formatTime(r.createdAt),
                    dishSummary: ((_a = r.dishes) !== null && _a !== void 0 ? _a : [])
                        .slice(0, 3)
                        .map((d) => d.briefCN || d.originalName)
                        .filter(Boolean)
                        .join("、") || "无菜品",
                    dishCount: ((_b = r.dishes) !== null && _b !== void 0 ? _b : []).length,
                    imageFileID: r.imageFileID || "",
                });
            });
            return list;
        }
        catch (e) {
            console.error("getRecentRecords failed:", e);
            return [];
        }
    });
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
