// 洋菜单 - OCR + DeepSeek-V3 分步识别：先 OCR 提取文字，再 DeepSeek 意译
// 环境变量：LKEAP_API_KEY（DeepSeek）、TENCENT_SECRET_ID、TENCENT_SECRET_KEY（OCR）
const LKEAP_API_KEY = process.env.LKEAP_API_KEY;
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID;
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY;

const cloud = require("wx-server-sdk");
const https = require("https");
const crypto = require("crypto");
const parser = require("./parser");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const OCR_HOST = "ocr.tencentcloudapi.com";
const OCR_SERVICE = "ocr";
const OCR_ACTION = "GeneralBasicOCR";
const OCR_VERSION = "2018-11-19";

const AI_MODEL = "deepseek-v3.2";
const AI_HOST = "api.lkeap.cloud.tencent.com";
const AI_PATH = "/v1/chat/completions";
const AI_TIMEOUT_MS = 55000;
const AI_MAX_TOKENS = 3200;
const OCR_INPUT_MAX_CHARS = 3200;

const SHARED_HTTP_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  timeout: 30000,
});

const DEEPSEEK_PROMPT = `你是菜单识别与菜品介绍助手。请基于 OCR 文本识别每道菜，并且仅返回 JSON，不要返回 Markdown、解释或多余文字。

【重要】目标用户为中国用户，以下所有面向用户展示的内容必须使用中文，禁止使用英文：
- description、flavor、recommendation、ingredients、options 的 group/rule/choices 等，全部必须用中文。

返回格式：
{
  "isMenu": true,
  "dishes": [
    {
      "originalName": "菜单原文菜名",
      "briefCN": "15字内中文概括",
      "description": "介绍菜品的特色点：起源、特色与做法（2-4句，可含背景由来与主要烹饪方式）",
      "flavor": "风味与口感（如酸甜苦辣咸、酱香、香辣、鲜、口感醇厚/脆嫩/软糯等）",
      "recommendation": "适合什么口味偏好的人，以及第一次来是否推荐尝试，一句话建议",
      "price": "¥38",
      "options": [{"group":"主食","rule":"二选一","choices":["米饭","面条"]}],
      "ingredients": ["生菜", "番茄"]
    }
  ]
}

要求：
- 严格返回合法 JSON；字段缺失时用空字符串 "" 或空数组 []。
- 按菜单上从上到下的顺序排列菜品，不要自行重排。
- briefCN 必须是中文且不超过 15 个字。
- description、flavor、recommendation 必须全部使用中文，禁止英文。
- ingredients 必须全部使用中文食材名（如 生菜、番茄、牛肉、芝士、培根），禁止英文如 lettuce、tomato、beef。
- options 的 group、rule、choices 必须使用中文。
- price 尽量保留原币种和格式，如 "¥38" / "38元" / "$8.9"；无价格返回 ""。
- 重要：每道菜都必须单独包含 price 字段；若菜单为多列（菜名一列、价格一列），请按行对应将价格填入该行的菜品对象中，不要只填第一道。
- ingredients 提取 2-6 个核心食材；无法判断时返回 []，禁止占位词如 "食材A"、"ingredient 1"。
- 只根据 OCR 文本合理推断，不要编造明显超出上下文的信息。
- 若 OCR 文本明显不是菜单（如路牌、广告、文档、书籍、网页等），请返回 {"isMenu": false, "dishes": []}，不要尝试解析菜品。

【质量优先】宁可少解析几道菜，也要保证每道菜的介绍充实有意义。若 OCR 文本较长，只处理前 15-20 道菜并给出丰富详尽的 description、flavor、recommendation，不要为凑数量而牺牲质量。description 至少 2-3 句，flavor 和 recommendation 要具体。`;

/** 腾讯云 API 3.0 TC3-HMAC-SHA256 签名（无 SDK，减小云函数体积） */
function signTc3(secretKey, date, service, stringToSign) {
  const hmac = (key, data) => crypto.createHmac("sha256", key).update(data, "utf8").digest();
  const secretDate = hmac("TC3" + secretKey, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, "tc3_request");
  return hmac(secretSigning, stringToSign).toString("hex");
}

/** 第1步：腾讯云 OCR 提取菜单文字（支持 ImageUrl 或 ImageBase64，无 SDK） */
function extractTextByOcr(imageInput) {
  const useUrl = typeof imageInput === "string" && imageInput.startsWith("http");
  const payloadObj = useUrl ? { ImageUrl: imageInput } : { ImageBase64: imageInput };

  return new Promise((resolve, reject) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10); // UTC yyyy-mm-dd
    const payload = JSON.stringify(payloadObj);
    const contentType = "application/json; charset=utf-8";

    const hashedPayload = crypto.createHash("sha256").update(payload, "utf8").digest("hex");
    const canonicalHeaders = `content-type:${contentType}\nhost:${OCR_HOST}\n`;
    const signedHeaders = "content-type;host";
    const canonicalRequest = [
      "POST",
      "/",
      "",
      canonicalHeaders,
      signedHeaders,
      hashedPayload,
    ].join("\n");
    const hashedCanonical = crypto.createHash("sha256").update(canonicalRequest, "utf8").digest("hex");
    const credentialScope = `${date}/${OCR_SERVICE}/tc3_request`;
    const stringToSign = [
      "TC3-HMAC-SHA256",
      String(timestamp),
      credentialScope,
      hashedCanonical,
    ].join("\n");
    const signature = signTc3(TENCENT_SECRET_KEY, date, OCR_SERVICE, stringToSign);
    const auth = `TC3-HMAC-SHA256 Credential=${TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const options = {
      hostname: OCR_HOST,
      path: "/",
      method: "POST",
      headers: {
        "Content-Type": contentType,
        Host: OCR_HOST,
        "X-TC-Action": OCR_ACTION,
        "X-TC-Version": OCR_VERSION,
        "X-TC-Timestamp": String(timestamp),
        "X-TC-Region": "ap-guangzhou",
        Authorization: auth,
        "Content-Length": Buffer.byteLength(payload, "utf8"),
      },
    };

    options.agent = SHARED_HTTP_AGENT;
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.Response?.Error) {
            reject(new Error(json.Response.Error.Message || "OCR 识别失败"));
            return;
          }
          const items = json.Response?.TextDetections || [];
          const text = items.map((t) => t.DetectedText || "").join("\n");
          resolve(text.trim());
        } catch (e) {
          reject(new Error("OCR 返回解析失败: " + (e.message || String(e))));
        }
      });
    });
    req.on("error", (e) => reject(new Error("OCR 网络错误: " + (e.message || String(e)))));
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("OCR 接口超时"));
    });
    req.write(payload, "utf8");
    req.end();
  });
}

function optimizeOcrText(raw) {
  const text = String(raw || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const deduped = [];
  const seen = new Set();
  for (const line of text) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(line);
    if (deduped.length >= 200) break;
  }

  const merged = deduped.join("\n");
  if (merged.length <= OCR_INPUT_MAX_CHARS) return { text: merged, truncated: false };
  return { text: merged.slice(0, OCR_INPUT_MAX_CHARS), truncated: true };
}

/** 第2步：调用 DeepSeek-V3 流式意译，边收边写 partialDishes 到 record */
function callDeepSeekStream(ocrText, recordId) {
  return new Promise((resolve, reject) => {
    const ocrResult = optimizeOcrText(ocrText);
    const optimizedText = ocrResult.text ?? ocrResult;
    const truncated = ocrResult.truncated ?? false;
    const userContent = `菜单 OCR 结果：
"""
${optimizedText}
"""
${DEEPSEEK_PROMPT}`;

    const body = JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.3,
      max_tokens: AI_MAX_TOKENS,
      stream: true,
      thinking: { type: "disabled" },
    });

    const options = {
      hostname: AI_HOST,
      path: AI_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LKEAP_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    let acc = "";
    let lastPartialCount = 0;
    let lastUpdateTime = 0;
    let finishReason = null;
    const THROTTLE_MS = 150;
    const records = db.collection("scan_records");

    /** 流式推送：有新菜品立即写入；同数量时每 400ms 推送一次更完整的 detail，确保部分卡片出现即可查看详情 */
    const updatePartial = async (dishes) => {
      if (dishes.length === 0) return;
      const now = Date.now();
      const countIncreased = dishes.length > lastPartialCount;
      const throttlePassed = now - lastUpdateTime >= THROTTLE_MS;
      if (!countIncreased && !throttlePassed) return;
      lastPartialCount = dishes.length;
      lastUpdateTime = now;
      try {
        await records.doc(recordId).update({
          data: { partialDishes: dishes, status: "processing" },
        });
      } catch (e) {
        console.warn("updatePartial failed:", e.message);
      }
    };

    options.agent = SHARED_HTTP_AGENT;
    const req = https.request(options, (res) => {
      const statusCode = res.statusCode || 0;
      const isErrorStatus = statusCode < 200 || statusCode >= 300;

      if (isErrorStatus) {
        let errBuf = "";
        res.on("data", (chunk) => { errBuf += chunk.toString(); });
        res.on("end", () => {
          let friendlyMsg = `识别失败（错误码：${statusCode}），请重试`;
          try {
            const errJson = errBuf ? JSON.parse(errBuf) : {};
            const apiMsg = errJson.error?.message || errJson.message;
            if (statusCode === 429) friendlyMsg = "服务繁忙，请稍后再试";
            else if (statusCode === 401) friendlyMsg = "服务配置异常，请联系开发者";
            else if ([500, 502, 503].includes(statusCode)) friendlyMsg = "识别服务暂时不可用，请稍后再试";
            else if (apiMsg) friendlyMsg = apiMsg;
          } catch (_) {}
          reject(new Error(friendlyMsg));
        });
        return;
      }

      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const choice = json.choices?.[0];
              const content = choice?.delta?.content;
              const reason = choice?.finish_reason;
              if (reason) finishReason = reason;
              if (content) {
                acc += content;
                let partial = parser.parseDishesFallback(acc);
                if (!partial || partial.length === 0) {
                  partial = parser.tryParsePartialDishes(acc);
                }
                if (!partial || partial.length === 0) {
                  try {
                    partial = parser.parseDishesMinimal(acc) || [];
                  } catch (_) {}
                }
                if (partial && partial.length > 0) {
                  const ocrPrices = parser.extractPricesFromOcrText(ocrText);
                  if (ocrPrices.length > 0) {
                    partial = parser.applyPricesByIndex(partial, ocrPrices);
                  }
                  updatePartial(partial);
                }
              }
            } catch (_) {}
          }
        }
      });
      res.on("end", () => {
        try {
          if (buf.startsWith("data: ") && buf !== "data: [DONE]") {
            try {
              const json = JSON.parse(buf.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              const reason = json.choices?.[0]?.finish_reason;
              if (reason) finishReason = reason;
              if (content) acc += content;
            } catch (_) {}
          }
          resolve({ text: acc.trim(), finishReason, truncated });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", (e) => reject(new Error("网络错误: " + (e.message || String(e)))));
    req.setTimeout(AI_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("识别接口超时，请重试"));
    });
    req.write(body);
    req.end();
  });
}

/** 第2步：调用 DeepSeek-V3 意译（非流式，一次性返回） */
function callDeepSeekWithText(ocrText) {
  return new Promise((resolve, reject) => {
    const ocrResult = optimizeOcrText(ocrText);
    const optimizedText = ocrResult.text ?? ocrResult;
    const userContent = `菜单 OCR 结果：
"""
${optimizedText}
"""
${DEEPSEEK_PROMPT}`;

    const body = JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "user", content: userContent }],
      temperature: 0.3,
      max_tokens: AI_MAX_TOKENS,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });

    const options = {
      hostname: AI_HOST,
      path: AI_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LKEAP_API_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    options.agent = SHARED_HTTP_AGENT;
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            let friendlyMsg = `DeepSeek 接口异常 (${res.statusCode})`;
            try {
              const errJson = data ? JSON.parse(data) : {};
              if (errJson.error?.code === "20031" || errJson.error?.code === "insufficient_quota") {
                friendlyMsg = "腾讯云账户余额不足，请前往控制台开通并充值";
              } else if (errJson.error?.message) friendlyMsg = errJson.error.message;
            } catch (_) {}
            reject(new Error(friendlyMsg));
            return;
          }
          if (!data || data.trim().length === 0) {
            reject(new Error("DeepSeek 返回空响应，请重试"));
            return;
          }
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || JSON.stringify(json.error)));
            return;
          }
          const content = json.choices?.[0]?.message?.content;
          if (!content || typeof content !== "string") {
            reject(new Error("DeepSeek 返回格式异常，请重试"));
            return;
          }
          resolve(String(content).trim());
        } catch (e) {
          reject(new Error("DeepSeek 返回解析失败: " + (e.message || String(e))));
        }
      });
    });

    req.on("error", (e) => reject(new Error("网络错误: " + (e.message || String(e)))));
    req.setTimeout(AI_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error("识别接口超时，请重试"));
    });
    req.write(body);
    req.end();
  });
}

exports.main = async (event) => {
  const {
    imageFileID,
    manualDishNames,
    saveRecord: shouldSave = true,
    debug = false,
    stream: useStream = false,
    streamRecordId,
  } = event;
  const hasManualInput = Array.isArray(manualDishNames) && manualDishNames.length > 0;

  if (debug) {
    console.log("recognizeMenu input:", {
      hasImageFileID: !!imageFileID,
      hasManualInput,
      shouldSave,
      useStream,
      streamRecordId,
      hasLkeapKey: !!LKEAP_API_KEY,
      hasOcrCred: !!(TENCENT_SECRET_ID && TENCENT_SECRET_KEY),
    });
  }

  if (!hasManualInput && !imageFileID && !streamRecordId) {
    return { success: false, error: "missing imageFileID" };
  }
  if (!LKEAP_API_KEY) {
    return {
      success: false,
      error:
        "missing LKEAP_API_KEY, set it in cloud function environment variables",
    };
  }
  if (!hasManualInput && (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY)) {
    return {
      success: false,
      error:
        "missing TENCENT_SECRET_ID / TENCENT_SECRET_KEY for OCR, set them in cloud function environment variables",
    };
  }

  // stream worker: process and continuously update partialDishes
  if (streamRecordId && imageFileID) {
    const recordId = streamRecordId;
    const records = db.collection("scan_records");
    try {
      const urlRes = await cloud.getTempFileURL({ fileList: [imageFileID] });
      const fileItem = urlRes?.fileList?.[0];
      const imageUrl = fileItem?.tempFileURL || fileItem?.temp_file_url;
      if (!imageUrl || (fileItem?.code && fileItem.code !== "SUCCESS")) {
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: "get image url failed" },
        });
        return { success: false, error: "get image url failed" };
      }

      const ocrText = await extractTextByOcr(imageUrl);
      if (!ocrText || ocrText.trim().length === 0) {
        const msg = "您上传的图片有问题。";
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: msg },
        });
        return { success: false, error: msg };
      }

      const streamResult = await callDeepSeekStream(ocrText, recordId);
      const aiText = typeof streamResult === "string" ? streamResult : streamResult.text;
      const finishReason = typeof streamResult === "object" ? streamResult.finishReason : null;
      const ocrTruncated = typeof streamResult === "object" ? streamResult.truncated : false;
      const menuTooLong = finishReason === "length" || ocrTruncated;
      const meta = parser.parseAiResponseMeta(aiText);
      if (meta && meta.isMenu === false) {
        const msg = "当前图片似乎不是菜单，请拍摄餐厅菜单进行识别";
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: msg },
        });
        return { success: false, error: msg };
      }
      let dishes = [];
      try {
        dishes = parser.parseDishesFromText(aiText);
      } catch (parseErr) {
        dishes = parser.parseDishesMinimal(aiText) || parser.parseDishesFallback(aiText) || [];
      }
      const ocrPrices = parser.extractPricesFromOcrText(ocrText);
      if (ocrPrices.length > 0) {
        dishes = parser.applyPricesByIndex(dishes, ocrPrices);
      }
      const updateData = { dishes, status: "done", partialDishes: [] };
      if (menuTooLong) {
        updateData.menuTooLongHint = "当前菜单太长，识别不完整。请你分段拍摄，以获取最佳体验。";
      }
      await records.doc(recordId).update({ data: updateData });
      return { success: true };
    } catch (e) {
      console.error("recognizeMenu stream worker error:", e);
      try {
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: (e.message || String(e)).slice(0, 200) },
        });
      } catch (_) {}
      return { success: false, error: e.message || String(e) };
    }
  }

  // stream entry: create processing record and invoke worker
  if (useStream && imageFileID) {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return { success: false, error: "failed to get openid" };

    const records = db.collection("scan_records");
    const addRes = await records.add({
      data: {
        _openid: openid,
        imageFileID,
        dishes: [],
        partialDishes: [],
        status: "processing",
        createdAt: db.serverDate(),
      },
    });
    const recordId = addRes._id ?? addRes.id;

    cloud
      .callFunction({
        name: "recognizeMenu",
        data: { imageFileID, streamRecordId: recordId },
      })
      .catch(async (e) => {
        console.error("Stream worker invocation failed:", e);
        try {
          await db.collection("scan_records").doc(recordId).update({
            data: {
              status: "error",
              errorMessage: "识别服务启动失败，请重试",
              updatedAt: new Date(),
            },
          });
        } catch (dbErr) {
          console.error("Failed to update record on worker error:", dbErr);
        }
      });

    return { success: true, data: { recordId, stream: true } };
  }

  let aiText = "";
  try {
    if (hasManualInput) {
      const normalizedNames = manualDishNames
        .map((name) => String(name || "").trim())
        .filter(Boolean)
        .slice(0, 40);

      if (normalizedNames.length === 0) {
        return { success: false, error: "manualDishNames is empty" };
      }

      const manualText = normalizedNames.join("\n");
      aiText = await callDeepSeekWithText(manualText);

      let dishes;
      try {
        dishes = parser.parseDishesFromText(aiText);
      } catch (parseErr) {
        dishes = parser.parseDishesMinimal(aiText);
        if (dishes.length === 0) {
          dishes = parser.parseDishesFallback(aiText);
        }
        if (dishes.length === 0) {
          if (debug) {
            return {
              success: false,
              error: "manual parse failed: " + parseErr.message,
              debugInfo: { rawResponse: aiText.slice(0, 3000), parseError: parseErr.message },
            };
          }
          throw parseErr;
        }
      }

      if (!shouldSave) {
        return { success: true, data: { dishes } };
      }

      const wxContext = cloud.getWXContext();
      const openid = wxContext.OPENID;
      if (!openid) {
        return { success: false, error: "failed to get openid" };
      }

      const addRes = await db.collection("scan_records").add({
        data: {
          _openid: openid,
          imageFileID: "",
          dishes,
          createdAt: db.serverDate(),
        },
      });

      const recordId = addRes._id ?? addRes.id;
      return {
        success: true,
        data: {
          recordId,
          dishes,
        },
      };
    }

    const urlRes = await cloud.getTempFileURL({ fileList: [imageFileID] });
    const fileItem = urlRes?.fileList?.[0];
    const imageUrl = fileItem?.tempFileURL || fileItem?.temp_file_url;
    if (!imageUrl || (fileItem?.code && fileItem.code !== "SUCCESS")) {
      console.error("recognizeMenu: get image url failed", fileItem);
      return { success: false, error: "get image url failed" };
    }

    const ocrText = await extractTextByOcr(imageUrl);
    if (!ocrText || ocrText.trim().length === 0) {
      return { success: false, error: "您上传的图片有问题。" };
    }
    if (debug) console.log("OCR text length:", ocrText.length);

    aiText = await callDeepSeekWithText(ocrText);
    if (!aiText || aiText.trim().length === 0) {
      console.warn("recognizeMenu: AI returned empty text");
      return { success: true, data: { dishes: [] } };
    }

    const meta = parser.parseAiResponseMeta(aiText);
    if (meta && meta.isMenu === false) {
      return { success: false, error: "当前图片似乎不是菜单，请拍摄餐厅菜单进行识别" };
    }

    let dishes;
    try {
      dishes = parser.parseDishesFromText(aiText);
    } catch (parseErr) {
      dishes = parser.parseDishesMinimal(aiText);
      if (dishes.length === 0) {
        dishes = parser.parseDishesFallback(aiText);
      }
      if (dishes.length === 0) {
        console.error("recognizeMenu parse failed:", parseErr.message);
        console.error("AI response:", aiText.slice(0, 1500));
        if (debug) {
          return {
            success: false,
            error: "menu parse failed: " + parseErr.message,
            debugInfo: { rawResponse: aiText.slice(0, 3000), parseError: parseErr.message },
          };
        }
        throw parseErr;
      }
      console.warn("recognizeMenu: full json parse failed, fallback parser used", dishes.length);
    }
    const ocrPrices = parser.extractPricesFromOcrText(ocrText);
    if (ocrPrices.length > 0) {
      dishes = parser.applyPricesByIndex(dishes, ocrPrices);
    }

    if (dishes.length === 0) {
      console.warn("recognizeMenu: no dishes parsed", aiText.slice(0, 500));
    }

    if (!shouldSave) {
      return { success: true, data: { dishes } };
    }

    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      return { success: false, error: "failed to get openid" };
    }

    const addRes = await db.collection("scan_records").add({
      data: {
        _openid: openid,
        imageFileID,
        dishes,
        createdAt: db.serverDate(),
      },
    });

    const recordId = addRes._id ?? addRes.id;
    return {
      success: true,
      data: {
        recordId,
        dishes,
      },
    };
  } catch (e) {
    const msg = e.message || String(e);
    const isParseError = /JSON|parse/i.test(msg);
    let errorMsg = isParseError ? "menu parse failed, please retry" : msg;
    if (isParseError && aiText) {
      errorMsg += " [AI raw] " + aiText.slice(0, 600);
    }
    const errRes = { success: false, error: errorMsg };
    if (aiText) {
      errRes.debugInfo = { rawResponse: aiText.slice(0, 3000), parseError: msg };
    }
    return errRes;
  }
};
