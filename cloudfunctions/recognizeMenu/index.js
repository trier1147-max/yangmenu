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
const AI_TIMEOUT_MS = 90000; // 从 55s 增加到 90s，应对文字多的菜单
const AI_MAX_TOKENS = 6000; // 质量优先：15-20 道菜详细描述约需 5500+ tokens
const OCR_INPUT_MAX_CHARS = 3000; // 质量优先：给 AI 更完整的菜单上下文

const SHARED_HTTP_AGENT = new https.Agent({
  keepAlive: true,
  maxSockets: 32,
  timeout: 30000,
});

const DEEPSEEK_PROMPT = `你是一个专业的菜单识别助手，帮助中国用户读懂海外餐厅菜单。

【质量第一 - 最高优先级】
- 每道菜的 description 至少 2-3 句，说明起源/特色/做法，有背景故事的要写出来
- flavor 要具体描述（不只是"鲜美"两字），写出层次感
- recommendation 要说明适合什么口味偏好的人，以及是否推荐第一次来的客人尝试
- 宁可只处理前 12-15 道主要菜品，也要保证每道菜介绍详尽充实，绝不为凑数量而牺牲质量

【输出格式】仅返回合法 JSON，不返回 Markdown、解释或任何多余文字：
{
  "isMenu": true,
  "dishes": [
    {
      "originalName": "菜单原文菜名（保留原文）",
      "briefCN": "15字内中文概括",
      "description": "菜品介绍：起源、特色与做法（2-4句，纯中文）",
      "flavor": "具体风味与口感描述，如香辣酥脆、酸甜鲜嫩、浓郁醇厚（纯中文）",
      "recommendation": "适合什么口味偏好的人，第一次来是否推荐尝试（纯中文）",
      "price": "原价格格式，如 $8.9 / €12 / ¥38 / £9.5 / ₩15000；无价格返回 \"\"",
      "options": [{"group":"主食","rule":"二选一","choices":["米饭","面条"]}],
      "ingredients": ["生菜", "番茄", "芝士"]
    }
  ]
}

【强制中文化】所有面向用户字段必须 100% 纯中文，严禁任何外文：
- description、flavor、recommendation、ingredients 禁止英/法/德/西/意/日/韩等任何外文
- 食材：必须用中文（生菜、番茄、牛肉、芝士、培根、罗勒、帕玛森芝士、马苏里拉芝士）
- 烹饪术语：用中文（煎、炒、炖、烤、蒸），禁止 grilled、rôti、asado、arrosto 等
- 口味描述：用中文（香辣、鲜甜、浓郁、酥脆），禁止 spicy、épicé、picante 等
- 专有名词（提拉米苏、凯撒沙拉、帕尼尼等已中文化名称）可保留，周边描述必须中文
- 无法翻译的生僻外文直接省略，不要保留任何非中文字符

❌ 错误："grilled chicken with lettuce and tomato"（英文）
✅ 正确："烤鸡肉配生菜番茄，香辣酥脆"

❌ 错误："poulet rôti avec salade verte"（法语）
✅ 正确："烤鸡配生菜沙拉"

❌ 错误："pasta tradizionale italiana con formaggio"（意大利语）
✅ 正确："传统意大利面配芝士"

【价格规则】
- 按原币种保留格式：$8.9 / €12 / ¥38 / £9.5 / ₩15000 / 38元
- 每道菜单独填写 price；多列菜单（菜名一列、价格一列）按行对应填入，不要只填第一道
- 严禁将卡路里（350kcal、200cal、500卡）、克重（200g）、毫升（500ml）误填为 price
- 无价格时返回 ""

【菜单判定】
- 非餐厅菜单（路牌/广告/收据/文档/书籍等）返回 {"isMenu": false, "dishes": []}
- 只有 1-2 个词，或完全不像食物相关内容，一律返回 {"isMenu": false, "dishes": []}

【仅识别菜品 - 严禁将说明文字当菜品】
- 只输出真正的食物/饮品名称，严禁将以下内容识别为菜品：
  - 英文说明、提示、注意事项（如 Allergen information、Gluten-free options、Please contact us、Terms and conditions、Ingredients may vary、Subject to availability）
  - 宣传语、餐厅简介、过敏原提示、服务费/税率说明、支付方式说明
  - 联系方式、版权声明、页码、社交媒体账号
- 若 OCR 文本中夹杂大量非菜品说明，只提取真正的菜名和价格，忽略说明段落

【originalName 规则】
- originalName 必须保留菜单上的完整菜名，严禁简化为单一食材或主料名
- 例：菜单写 "Burrata with tomato and basil" → originalName 填 "Burrata with tomato and basil"，不能只填 "Burrata" 或 "布拉塔奶酪"
- 若 OCR 有拼写错误（Caeaser→Caesar、0/O、l/1 等），可修正 typo，但不得删减、合并或改写菜名
- description 必须描述「这道菜」的做法与呈现，禁止只介绍某一种食材本身（如只介绍布拉塔奶酪是什么）

【其他规则】
- 按菜单从上到下顺序排列，不自行重排
- briefCN 纯中文不超过 15 字
- ingredients 提取 2-6 个核心食材（中文），无法判断返回 []，禁止"食材A"等占位词
- 字段缺失用 "" 或 []，只根据 OCR 文本合理推断，不编造超出上下文的信息
- 最终检查：description/flavor/recommendation/ingredients 中不允许任何拉丁字母、假名、韩文`;

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
  const inputType = useUrl ? 'URL' : 'Base64';
  const inputSize = typeof imageInput === 'string' ? imageInput.length : 0;
  console.log(`[OCR] Starting OCR with ${inputType}, size: ${(inputSize / 1024).toFixed(1)}KB`);
  const startTime = Date.now();

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
          const duration = Date.now() - startTime;
          const textLength = text.trim().length;
          console.log(`[OCR] ✅ Completed in ${duration}ms, extracted ${textLength} chars (${items.length} text blocks)`);
          resolve(text.trim());
        } catch (e) {
          reject(new Error("OCR 返回解析失败: " + (e.message || String(e))));
        }
      });
    });
    req.on("error", (e) => {
      const duration = Date.now() - startTime;
      console.error(`[OCR] ❌ Network error after ${duration}ms:`, e.message);
      reject(new Error("OCR 网络错误: " + (e.message || String(e))));
    });
    req.setTimeout(30000, () => {  // 从 15s 增加到 30s，应对大图/密集文字
      console.error(`[OCR] ❌ TIMEOUT after 30s (input: ${inputType}, size: ${(inputSize / 1024).toFixed(1)}KB)`);
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
    const userContent = `请识别以下菜单 OCR 文本并返回 JSON：\n"""\n${optimizedText}\n"""`;

    const body = JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: DEEPSEEK_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.5,
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

    const defaultCurrency = parser.detectCurrencyFromOcrText(ocrText);

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
                  partial = parser.tryParsePartialDishes(acc, defaultCurrency);
                }
                if (!partial || partial.length === 0) {
                  try {
                    partial = parser.parseDishesMinimal(acc, defaultCurrency) || [];
                  } catch (_) {}
                }
                if (partial && partial.length > 0) {
                  const ocrPrices = parser.extractPricesFromOcrText(ocrText);
                  if (ocrPrices.length > 0) {
                    partial = parser.applyPricesByIndex(partial, ocrPrices, defaultCurrency);
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
    const userContent = `请识别以下菜单 OCR 文本并返回 JSON：\n"""\n${optimizedText}\n"""`;

    const body = JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: DEEPSEEK_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.5,
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
  // 无条件入口日志：若云控制台完全无日志，说明请求未到达云端（客户端超限/网络失败）
  const inputType = event.imageBase64 ? "base64" : event.imageFileID ? "fileID" : event.imageFileIDs ? "fileIDs" : event.streamRecordId ? "streamWorker" : event.manualDishNames ? "manual" : "unknown";
  const payloadSize = event.imageBase64 ? (event.imageBase64.length || 0) : 0;
  console.log(`[recognizeMenu] 入口 inputType=${inputType} payloadSize=${(payloadSize / 1024).toFixed(1)}KB`);

  const {
    imageFileID,
    imageFileIDs,
    manualDishNames,
    saveRecord: shouldSave = true,
    debug = false,
    stream: useStream = false,
    streamRecordId,
    imageUrl: eventImageUrl,
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

  if (!hasManualInput && !imageFileID && !event.imageBase64 && !event.imageFileIDs && !streamRecordId) {
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

  // ocrText stream worker: AI streaming only (OCR already done in entry, saves double base64 transfer)
  if (streamRecordId && event.ocrText) {
    const recordId = streamRecordId;
    const ocrText = event.ocrText;
    const records = db.collection("scan_records");
    try {
      const streamResult = await callDeepSeekStream(ocrText, recordId);
      const aiText = typeof streamResult === "string" ? streamResult : streamResult.text;
      const finishReason = typeof streamResult === "object" ? streamResult.finishReason : null;
      const ocrTruncated = typeof streamResult === "object" ? streamResult.truncated : false;
      const menuTooLong = finishReason === "length" || ocrTruncated;
      const meta = parser.parseAiResponseMeta(aiText);
      if (meta && meta.isMenu === false) {
        const msg = "这张图片不像是餐厅菜单哦，请对准菜单重新拍摄";
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: msg },
        });
        return { success: false, error: msg };
      }
      const defaultCurrency = parser.detectCurrencyFromOcrText(ocrText);
      let dishes = [];
      try {
        dishes = parser.parseDishesFromText(aiText, defaultCurrency);
      } catch (parseErr) {
        dishes = parser.parseDishesMinimal(aiText, defaultCurrency) || parser.parseDishesFallback(aiText) || [];
      }
      const ocrPrices = parser.extractPricesFromOcrText(ocrText);
      if (ocrPrices.length > 0) {
        dishes = parser.applyPricesByIndex(dishes, ocrPrices, defaultCurrency);
      }
      const updateData = { dishes, status: "done", partialDishes: [] };
      if (menuTooLong) {
        updateData.menuTooLongHint = "当前菜单太长，识别不完整。请你分段拍摄，以获取最佳体验。";
      }
      await records.doc(recordId).update({ data: updateData });
      return { success: true };
    } catch (e) {
      console.error("recognizeMenu ocrText stream worker error:", e);
      try {
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: (e.message || String(e)).slice(0, 200) },
        });
      } catch (_) {}
      return { success: false, error: e.message || String(e) };
    }
  }

  // batch stream worker: process multiple images sequentially, merge dishes into partialDishes
  if (streamRecordId && Array.isArray(imageFileIDs) && imageFileIDs.length > 0) {
    const recordId = streamRecordId;
    const records = db.collection("scan_records");
    let allDishes = [];
    let hasError = false;
    let menuTooLong = false;

    for (const fileID of imageFileIDs) {
      try {
        const urlRes = await cloud.getTempFileURL({ fileList: [fileID] });
        const fileItem = urlRes?.fileList?.[0];
        const imageUrl = fileItem?.tempFileURL || fileItem?.temp_file_url;
        if (!imageUrl || (fileItem?.code && fileItem.code !== "SUCCESS")) {
          console.warn("batch stream: get image url failed for", fileID);
          continue;
        }

        const ocrText = await extractTextByOcr(imageUrl);
        if (!ocrText || ocrText.trim().length === 0) {
          console.warn("batch stream: empty OCR for", fileID);
          continue;
        }

        const aiText = await callDeepSeekWithText(ocrText);
        if (!aiText || aiText.trim().length === 0) {
          console.warn("batch stream: empty AI response for", fileID);
          continue;
        }

        const meta = parser.parseAiResponseMeta(aiText);
        if (meta && meta.isMenu === false) {
          console.warn("batch stream: not a menu for", fileID);
          continue;
        }

        const defaultCurrency = parser.detectCurrencyFromOcrText(ocrText);
        let dishes;
        try {
          dishes = parser.parseDishesFromText(aiText, defaultCurrency);
        } catch (parseErr) {
          dishes = parser.parseDishesMinimal(aiText, defaultCurrency) || parser.parseDishesFallback(aiText) || [];
        }
        const ocrPrices = parser.extractPricesFromOcrText(ocrText);
        if (ocrPrices.length > 0) {
          dishes = parser.applyPricesByIndex(dishes, ocrPrices, defaultCurrency);
        }

        if (dishes.length > 0) {
          allDishes = allDishes.concat(dishes);
          // Update partialDishes after each image so frontend can show progress
          try {
            await records.doc(recordId).update({
              data: { partialDishes: allDishes, status: "processing" },
            });
          } catch (e) {
            console.warn("batch stream: updatePartial failed:", e.message);
          }
        }
      } catch (e) {
        console.error("batch stream: error processing image", fileID, e.message);
        hasError = true;
      }
    }

    // Finalize record
    try {
      if (allDishes.length > 0) {
        const updateData = { dishes: allDishes, status: "done", partialDishes: [] };
        if (menuTooLong) {
          updateData.menuTooLongHint = "当前菜单太长，识别不完整。请你分段拍摄，以获取最佳体验。";
        }
        await records.doc(recordId).update({ data: updateData });
      } else {
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: "未识别到有效菜品" },
        });
      }
    } catch (e) {
      console.error("batch stream: finalize failed:", e.message);
    }
    return { success: true };
  }

  // single imageFileID stream worker: get URL, OCR, then AI stream (for large images that exceed base64 limit)
  if (streamRecordId && imageFileID && !Array.isArray(imageFileIDs)) {
    const recordId = streamRecordId;
    const records = db.collection("scan_records");
    try {
      // entry 已并行获取 imageUrl 并传入，直接使用；否则降级自己获取
      let imageUrl = eventImageUrl || null;
      if (!imageUrl) {
        const urlRes = await cloud.getTempFileURL({ fileList: [imageFileID] });
        const fileItem = urlRes?.fileList?.[0];
        imageUrl = fileItem?.tempFileURL || fileItem?.temp_file_url;
        if (!imageUrl || (fileItem?.code && fileItem.code !== "SUCCESS")) {
          await records.doc(recordId).update({
            data: { status: "error", errorMessage: "获取图片失败" },
          });
          return { success: false, error: "get image url failed" };
        }
      }
      const ocrText = await extractTextByOcr(imageUrl);
      if (!ocrText || ocrText.trim().length === 0) {
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: "您上传的图片有问题。" },
        });
        return { success: false, error: "OCR empty" };
      }
      const streamResult = await callDeepSeekStream(ocrText, recordId);
      const aiText = typeof streamResult === "string" ? streamResult : streamResult.text;
      const finishReason = typeof streamResult === "object" ? streamResult.finishReason : null;
      const ocrTruncated = typeof streamResult === "object" ? streamResult.truncated : false;
      const menuTooLong = finishReason === "length" || ocrTruncated;
      const meta = parser.parseAiResponseMeta(aiText);
      if (meta && meta.isMenu === false) {
        const msg = "这张图片不像是餐厅菜单哦，请对准菜单重新拍摄";
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: msg },
        });
        return { success: false, error: msg };
      }
      const defaultCurrency = parser.detectCurrencyFromOcrText(ocrText);
      let dishes = [];
      try {
        dishes = parser.parseDishesFromText(aiText, defaultCurrency);
      } catch (parseErr) {
        dishes = parser.parseDishesMinimal(aiText, defaultCurrency) || parser.parseDishesFallback(aiText) || [];
      }
      const ocrPrices = parser.extractPricesFromOcrText(ocrText);
      if (ocrPrices.length > 0) {
        dishes = parser.applyPricesByIndex(dishes, ocrPrices, defaultCurrency);
      }
      const updateData = { dishes, status: "done", partialDishes: [] };
      if (menuTooLong) {
        updateData.menuTooLongHint = "当前菜单太长，识别不完整。请你分段拍摄，以获取最佳体验。";
      }
      await records.doc(recordId).update({ data: updateData });
      return { success: true };
    } catch (e) {
      console.error("recognizeMenu single imageFileID stream worker error:", e);
      try {
        await records.doc(recordId).update({
          data: { status: "error", errorMessage: (e.message || String(e)).slice(0, 200) },
        });
      } catch (_) {}
      return { success: false, error: e.message || String(e) };
    }
  }

  // batch stream entry: create processing record and invoke batch worker
  if (useStream && Array.isArray(imageFileIDs) && imageFileIDs.length > 0) {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return { success: false, error: "failed to get openid" };

    const records = db.collection("scan_records");
    const addRes = await records.add({
      data: {
        _openid: openid,
        imageFileID: imageFileIDs[0],
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
        data: { imageFileIDs, streamRecordId: recordId },
      })
      .catch(async (e) => {
        console.error("Batch stream worker invocation failed:", e);
        try {
          await db.collection("scan_records").doc(recordId).update({
            data: {
              status: "error",
              errorMessage: "识别服务启动失败，请重试",
              updatedAt: new Date(),
            },
          });
        } catch (dbErr) {
          console.error("Failed to update record on batch worker error:", dbErr);
        }
      });

    return { success: true, data: { recordId, stream: true } };
  }

  // single imageFileID stream entry: for large images that exceed base64 limit (upload first, then stream)
  if (useStream && imageFileID && !event.imageBase64) {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return { success: false, error: "failed to get openid" };

    const records = db.collection("scan_records");

    // 并行：创建 DB 记录 + 获取图片 CDN URL，省去 worker 侧重复调用 getTempFileURL
    const [addRes, urlRes] = await Promise.all([
      records.add({
        data: {
          _openid: openid,
          imageFileID,
          dishes: [],
          partialDishes: [],
          status: "processing",
          createdAt: db.serverDate(),
        },
      }),
      cloud.getTempFileURL({ fileList: [imageFileID] }).catch(() => null),
    ]);
    const recordId = addRes._id ?? addRes.id;
    const imageUrl = urlRes?.fileList?.[0]?.tempFileURL || urlRes?.fileList?.[0]?.temp_file_url || null;

    cloud
      .callFunction({
        name: "recognizeMenu",
        // 若拿到了 URL 就直接传给 worker，worker 可跳过 getTempFileURL
        data: { imageFileID, imageUrl, streamRecordId: recordId },
      })
      .catch(async (e) => {
        console.error("Single imageFileID stream worker invocation failed:", e);
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

  // base64 stream entry: do OCR in entry, pass ocrText (tiny) to worker instead of base64 (large)
  if (useStream && event.imageBase64) {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) return { success: false, error: "failed to get openid" };

    // OCR 在 entry 里做，避免 base64 二次传输给 worker（省 ~1-2s）
    let ocrText;
    try {
      ocrText = await extractTextByOcr(event.imageBase64);
    } catch (e) {
      return { success: false, error: e.message || "OCR 识别失败" };
    }
    if (!ocrText || ocrText.trim().length === 0) {
      return { success: false, error: "您上传的图片有问题。" };
    }

    const records = db.collection("scan_records");
    const addRes = await records.add({
      data: {
        _openid: openid,
        imageFileID: "",
        dishes: [],
        partialDishes: [],
        status: "processing",
        createdAt: db.serverDate(),
      },
    });
    const recordId = addRes._id ?? addRes.id;

    // 只传 ocrText（几KB）给 worker，不传 base64（几百KB）
    cloud
      .callFunction({
        name: "recognizeMenu",
        data: { ocrText, streamRecordId: recordId },
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
      return { success: false, error: "这张图片不像是餐厅菜单哦，请对准菜单重新拍摄" };
    }

    const defaultCurrency = parser.detectCurrencyFromOcrText(ocrText);
    let dishes;
    try {
      dishes = parser.parseDishesFromText(aiText, defaultCurrency);
    } catch (parseErr) {
      dishes = parser.parseDishesMinimal(aiText, defaultCurrency);
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
      dishes = parser.applyPricesByIndex(dishes, ocrPrices, defaultCurrency);
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
