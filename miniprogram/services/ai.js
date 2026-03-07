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
exports.uploadImage = void 0;
exports.recognizeMenuStream = recognizeMenuStream;
exports.recognizeMenu = recognizeMenu;
exports.recognizeManualDishes = recognizeManualDishes;
exports.saveRecord = saveRecord;
const cloud_1 = require("./cloud");
function recognizeMenuStream(imageFileID) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const res = yield (0, cloud_1.callFunction)("recognizeMenu", { imageFileID, stream: true });
        if (!res.success || !((_a = res.data) === null || _a === void 0 ? void 0 : _a.recordId)) {
            return { error: (_b = res.error) !== null && _b !== void 0 ? _b : "start stream failed" };
        }
        return { recordId: res.data.recordId };
    });
}
function recognizeMenu(imageFileID_1) {
    return __awaiter(this, arguments, void 0, function* (imageFileID, saveRecord = true, debug = false) {
        var _a;
        const res = yield (0, cloud_1.callFunction)("recognizeMenu", { imageFileID, saveRecord, debug });
        if (!res.success || !((_a = res.data) === null || _a === void 0 ? void 0 : _a.dishes)) {
            return { dishes: [], error: res.error };
        }
        return {
            dishes: res.data.dishes,
            recordId: res.data.recordId,
        };
    });
}
function recognizeManualDishes(dishNames) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const res = yield (0, cloud_1.callFunction)("recognizeMenu", { manualDishNames: dishNames, saveRecord: true });
        if (!res.success || !((_a = res.data) === null || _a === void 0 ? void 0 : _a.dishes)) {
            return { dishes: [], error: (_b = res.error) !== null && _b !== void 0 ? _b : "manual recognition failed" };
        }
        return {
            dishes: res.data.dishes,
            recordId: res.data.recordId,
        };
    });
}
function saveRecord(imageFileID, dishes) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const res = yield (0, cloud_1.callFunction)("saveRecord", {
            imageFileID,
            dishes,
        });
        return res.success && ((_a = res.data) === null || _a === void 0 ? void 0 : _a.recordId) ? res.data.recordId : null;
    });
}
var cloud_2 = require("./cloud");
Object.defineProperty(exports, "uploadImage", { enumerable: true, get: function () { return cloud_2.uploadImage; } });
