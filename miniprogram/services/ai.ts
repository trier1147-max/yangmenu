import { callFunction, uploadImage } from "./cloud";
import type { Dish } from "../utils/types";

export async function recognizeMenuBase64Stream(
  imageBase64: string
): Promise<{ recordId?: string; error?: string }> {
  const res = await callFunction<{ recordId: string; stream?: boolean }>(
    "recognizeMenu",
    { imageBase64, stream: true }
  );
  if (!res.success || !res.data?.recordId) {
    return { error: res.error ?? "start base64 stream failed" };
  }
  return { recordId: res.data.recordId };
}

export async function recognizeMenuBatchStream(
  imageFileIDs: string[]
): Promise<{ recordId?: string; error?: string }> {
  const res = await callFunction<{ recordId: string; stream?: boolean }>(
    "recognizeMenu",
    { imageFileIDs, stream: true }
  );
  if (!res.success || !res.data?.recordId) {
    return { error: res.error ?? "start batch stream failed" };
  }
  return { recordId: res.data.recordId };
}

/** 单图流式（imageFileID）：用于 base64 超限时，先上传再走流式 */
export async function recognizeMenuStream(
  imageFileID: string
): Promise<{ recordId?: string; error?: string }> {
  const res = await callFunction<{ recordId: string; stream?: boolean }>(
    "recognizeMenu",
    { imageFileID, stream: true }
  );
  if (!res.success || !res.data?.recordId) {
    return { error: res.error ?? "start stream failed" };
  }
  return { recordId: res.data.recordId };
}

export async function recognizeMenu(
  imageFileID: string,
  saveRecord = true,
  debug = false
): Promise<{ dishes: Dish[]; recordId?: string; error?: string }> {
  const res = await callFunction<{ dishes: Dish[]; recordId?: string }>(
    "recognizeMenu",
    { imageFileID, saveRecord, debug }
  );
  if (!res.success || !res.data?.dishes) {
    return { dishes: [], error: res.error };
  }
  return {
    dishes: res.data.dishes,
    recordId: res.data.recordId,
  };
}

export async function recognizeManualDishes(
  dishNames: string[]
): Promise<{ dishes: Dish[]; recordId?: string; error?: string }> {
  const res = await callFunction<{ dishes: Dish[]; recordId?: string }>(
    "recognizeMenu",
    { manualDishNames: dishNames, saveRecord: true }
  );
  if (!res.success || !res.data?.dishes) {
    return { dishes: [], error: res.error ?? "manual recognition failed" };
  }
  return {
    dishes: res.data.dishes,
    recordId: res.data.recordId,
  };
}

export { uploadImage } from "./cloud";
