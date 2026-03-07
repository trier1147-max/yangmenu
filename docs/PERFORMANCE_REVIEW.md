# 洋菜单 recognizeMenu 云函数性能审查报告

## 一、当前流程概览

```
用户拍照/选图 → 前端压缩(quality 60, 1024px) → 上传云存储 → 调用云函数
                                                      ↓
云函数: downloadFile → base64 编码 → OCR(GeneralBasicOCR) → DeepSeek 意译 → 解析 → 保存 DB → 返回
```

**预估耗时分解（单张图）**：
| 环节 | 预估耗时 | 说明 |
|------|----------|------|
| 前端压缩 + 上传 | 2-5s | 取决于网络与图片大小 |
| 云函数冷启动 | 1-3s | 256MB 内存，首次调用 |
| downloadFile | 0.5-2s | 云存储同区域较快 |
| base64 编码 | 0.1-0.5s | 与图片大小相关 |
| OCR (GeneralBasicOCR) | 1-2s | 同步接口，腾讯云优化后约 0.8-2s |
| **DeepSeek 意译** | **8-15s** | **主要瓶颈** |
| 解析 + 保存 DB | <0.5s | 可忽略 |
| **合计** | **约 13-28s** | 与网络、冷启动、AI 负载相关 |

---

## 二、逐项分析

### 1. 云函数代码结构（串行等待）

**现状**：流程严格串行，无并行空间。

```javascript
// 当前顺序（index.js 319-334 行）
const fileRes = await cloud.downloadFile({ fileID: imageFileID });
const base64 = buf.toString("base64")...;
const ocrText = await extractTextByOcr(base64);   // 依赖 base64
aiText = await callDeepSeekWithText(ocrText);      // 依赖 ocrText
```

**结论**：OCR 依赖图片，DeepSeek 依赖 OCR 结果，逻辑上必须串行，无法并行。

**可优化点**：将「下载 + base64」改为「getTempFileURL + ImageUrl」，减少云函数内耗时（见第 4 节）。

---

### 2. OCR 轮询方式

**现状**：使用的是 **GeneralBasicOCR**，为**同步接口**，无轮询。

- 一次请求即返回结果
- 腾讯云文档解析类（如 SmartStructuralOCR、文档识别异步任务）才有「提交任务 → 轮询结果」的模式
- 当前实现不存在 OCR 轮询

**结论**：OCR 本身不是轮询导致变慢，而是同步调用，已属较快方案。

**可选优化**：若菜单为表格/结构化文档，可评估 **TableOCR** 或 **SmartStructuralOCR** 是否更合适，但需实测对比耗时。

---

### 3. DeepSeek 调用优化

**现状**：
- `thinking: { type: "disabled" }` 已禁用，避免额外推理
- `temperature: 0.3` 合理
- `max_tokens: 4096` 偏大

**优化建议**：

| 项目 | 当前 | 建议 | 预期效果 |
|------|------|------|----------|
| max_tokens | 4096 | 2048 | 减少生成上限，菜单通常不需 4K token |
| prompt 精简 | system + user 重复说明 | 合并为单条 user，去掉重复 | 减少输入 token，略微加速 |
| 输出格式 | 完整 JSON | 已用 response_format | 已优化 |

**示例精简 prompt**（保留核心要求即可）：
```javascript
// 当前：system 与 DEEPSEEK_PROMPT 有重复
// 建议：合并为一条 user，去掉「你是一位...」等冗余
const userContent = `菜单 OCR 结果：
"""
${ocrText}
"""
请识别每道菜，返回 JSON：{"dishes":[{"originalName":"原文","briefCN":"15字内概括","description":"2-3句说明","ingredients":["食材"],"flavor":"口味"}]}，仅返回 JSON 无其他文字。`;
```

---

### 4. 图片处理环节

**现状**：
1. 前端：`wx.compressImage`（quality 60, 1024px）已做压缩
2. 云端：`downloadFile` 下载完整文件 → `buf.toString("base64")` 编码 → 传给 OCR

**冗余点**：
- 云函数需要把图片下载到内存再 base64，多一次传输和编码
- 腾讯云 OCR 支持 **ImageUrl**，且「图片存储于腾讯云时，使用 URL 更优」

**优化方案**：用 `getTempFileURL` 替代 `downloadFile` + base64

```javascript
// 原流程：downloadFile → base64 → OCR(ImageBase64)
// 新流程：getTempFileURL → OCR(ImageUrl)

const urlRes = await cloud.getTempFileURL({ fileList: [imageFileID] });
const tempUrl = urlRes.fileList?.[0]?.tempFileURL;
if (!tempUrl) return { success: false, error: "获取图片链接失败" };

const ocrText = await extractTextByOcr(tempUrl);  // 改为传 URL
```

`extractTextByOcr` 需改为支持 ImageUrl：

```javascript
async function extractTextByOcr(imageInput) {
  const client = new OcrClient({...});
  const params = imageInput.startsWith("http")
    ? { ImageUrl: imageInput }
    : { ImageBase64: imageInput };
  const res = await client.GeneralBasicOCR(params);
  // ...
}
```

**预期收益**：省去 downloadFile 和 base64 编码，约可节省 0.5-2s。

---

### 5. 可并行的操作

**单张图**：OCR → DeepSeek 有强依赖，无法并行。

**多张图**：前端已用 `Promise.all` 并行调用 `recognizeMenu`，云函数侧无额外并行空间。

**可选优化**：将「保存 DB」与「返回结果」解耦，先返回再异步写入 DB，但会带来一致性风险，一般不推荐。

---

## 三、综合优化建议（按优先级）

### 高优先级（建议实施）

1. **OCR 使用 ImageUrl**
   - 用 `getTempFileURL` 替代 `downloadFile` + base64
   - 预计节省 0.5-2s

2. **云函数内存**
   - 将 `config.json` 中 `memorySize` 从 256 调整为 512
   - 减轻冷启动影响

3. **DeepSeek max_tokens**
   - 从 4096 调整为 2048
   - 降低生成上限，可能略微缩短响应时间

### 中优先级（可选）

4. **精简 DeepSeek prompt**
   - 合并 system/user，去掉重复描述
   - 减少输入 token

5. **前端压缩参数**
   - 若识别效果允许，可尝试 `quality: 50` 或 `compressedWidth: 800`
   - 减小上传体积，加快上传与云端处理

### 低优先级（架构级）

6. **流式输出（SSE）**
   - 需要改造为流式接口 + 前端逐步渲染
   - 开发成本高，但可明显改善「体感速度」

7. **预加载 / 预热**
   - 定时调用空请求以保持云函数热实例
   - 仅在有明显冷启动问题时考虑

---

## 四、结论

- **主要瓶颈**：DeepSeek 意译（约 8-15s），占总耗时大部分。
- **OCR**：使用同步 GeneralBasicOCR，无轮询，已属较快方案。
- **可落地优化**：OCR 改用 ImageUrl、提高云函数内存、降低 max_tokens、精简 prompt，预计可节省 1-3s。
- **根本限制**：大模型推理耗时难以大幅压缩，若需明显提速，需考虑流式输出或「先返回简要结果、再异步补充详情」等产品策略。

---

## 五、已实施的优化（2026-03）

| 优化项 | 修改 | 预期收益 |
|--------|------|----------|
| OCR ImageUrl | getTempFileURL 替代 downloadFile + base64 | 0.5-2s |
| 云函数内存 | 256 → 512 MB | 减轻冷启动 |
| DeepSeek max_tokens | 4096 → 2048 | 略微加速 |
| DeepSeek prompt | 合并 system/user，精简描述 | 减少输入 token |

---

## 六、流式传输方案（已实现）

单图识别采用「流式」体感：

1. **入口**：前端调用 `recognizeMenuStream(imageFileID)`，云函数创建一条 `status: 'processing'` 的记录后**立即返回 recordId**，并**不等待**异步触发同一云函数（stream worker）。
2. **后台 worker**：另一实例执行 OCR → DeepSeek **stream 请求**，每收到一段 SSE 就拼好 JSON，尝试解析出已完整的菜品，**边收边写** `partialDishes` 到该条记录。
3. **前端**：拿到 recordId 后直接跳转菜单列表页；列表页用 **db.collection('scan_records').doc(recordId).watch()** 监听该条记录，用 `partialDishes` 或最终的 `dishes` 实时更新列表，识别完自动切为 `status: 'done'` 并停止 watch。

效果：用户无需等 20 秒才看到结果，先进入列表页，菜品会一条条或分批出现，体感更快。
