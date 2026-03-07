"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = void 0;
exports.recognizeMenuStream = recognizeMenuStream;
exports.recognizeMenu = recognizeMenu;
exports.recognizeManualDishes = recognizeManualDishes;
exports.saveRecord = saveRecord;
const cloud_1 = require("./cloud");
async function recognizeMenuStream(imageFileID) {
    var _a, _b;
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { imageFileID, stream: true });
    if (!res.success || !((_a = res.data) === null || _a === void 0 ? void 0 : _a.recordId)) {
        return { error: (_b = res.error) !== null && _b !== void 0 ? _b : "start stream failed" };
    }
    return { recordId: res.data.recordId };
}
async function recognizeMenu(imageFileID, saveRecord = true, debug = false) {
    var _a;
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { imageFileID, saveRecord, debug });
    if (!res.success || !((_a = res.data) === null || _a === void 0 ? void 0 : _a.dishes)) {
        return { dishes: [], error: res.error };
    }
    return {
        dishes: res.data.dishes,
        recordId: res.data.recordId,
    };
}
async function recognizeManualDishes(dishNames) {
    var _a, _b;
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { manualDishNames: dishNames, saveRecord: true });
    if (!res.success || !((_a = res.data) === null || _a === void 0 ? void 0 : _a.dishes)) {
        return { dishes: [], error: (_b = res.error) !== null && _b !== void 0 ? _b : "manual recognition failed" };
    }
    return {
        dishes: res.data.dishes,
        recordId: res.data.recordId,
    };
}
async function saveRecord(imageFileID, dishes) {
    var _a;
    const res = await (0, cloud_1.callFunction)("saveRecord", {
        imageFileID,
        dishes,
    });
    return res.success && ((_a = res.data) === null || _a === void 0 ? void 0 : _a.recordId) ? res.data.recordId : null;
}
var cloud_2 = require("./cloud");
Object.defineProperty(exports, "uploadImage", { enumerable: true, get: function () { return cloud_2.uploadImage; } });
