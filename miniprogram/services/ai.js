"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImage = void 0;
exports.recognizeMenuBase64Stream = recognizeMenuBase64Stream;
exports.recognizeMenuBatchStream = recognizeMenuBatchStream;
exports.recognizeMenuStream = recognizeMenuStream;
exports.recognizeMenu = recognizeMenu;
exports.recognizeManualDishes = recognizeManualDishes;
const cloud_1 = require("./cloud");
async function recognizeMenuBase64Stream(imageBase64) {
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { imageBase64, stream: true });
    if (!res.success || !res.data?.recordId) {
        return { error: res.error ?? "start base64 stream failed" };
    }
    return { recordId: res.data.recordId };
}
async function recognizeMenuBatchStream(imageFileIDs) {
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { imageFileIDs, stream: true });
    if (!res.success || !res.data?.recordId) {
        return { error: res.error ?? "start batch stream failed" };
    }
    return { recordId: res.data.recordId };
}
async function recognizeMenuStream(imageFileID) {
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { imageFileID, stream: true });
    if (!res.success || !res.data?.recordId) {
        return { error: res.error ?? "start stream failed" };
    }
    return { recordId: res.data.recordId };
}
async function recognizeMenu(imageFileID, saveRecord = true, debug = false) {
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { imageFileID, saveRecord, debug });
    if (!res.success || !res.data?.dishes) {
        return { dishes: [], error: res.error };
    }
    return {
        dishes: res.data.dishes,
        recordId: res.data.recordId,
    };
}
async function recognizeManualDishes(dishNames) {
    const res = await (0, cloud_1.callFunction)("recognizeMenu", { manualDishNames: dishNames, saveRecord: true });
    if (!res.success || !res.data?.dishes) {
        return { dishes: [], error: res.error ?? "manual recognition failed" };
    }
    return {
        dishes: res.data.dishes,
        recordId: res.data.recordId,
    };
}
var cloud_2 = require("./cloud");
Object.defineProperty(exports, "uploadImage", { enumerable: true, get: function () { return cloud_2.uploadImage; } });
