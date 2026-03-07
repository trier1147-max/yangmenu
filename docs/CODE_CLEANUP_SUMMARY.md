# 洋菜单 - 代码质量优化总结

## 一、已完成的清理

### 1. 移除未使用页面与组件

| 删除项 | 原因 |
|--------|------|
| `pages/example/` | 云开发 quickstart 模板页，未在 app.json 注册，非业务页面 |
| `components/cloudTipModal/` | 仅被 example 引用，随 example 一并移除 |
| `pages/dish-detail/` | 从未被 navigateTo，.cursorrules 标注为「Reserved」，实际未使用 |

### 2. 移除死代码

| 删除项 | 原因 |
|--------|------|
| `cloudfunctions/explainDish/` | 单道菜解读云函数，one-shot 流程下 detail 已在 recognizeMenu 返回，无调用方 |
| `services/ai.ts` 中的 `explainDish` 导出 | 无调用方 |
| `services/user.ts` | 全部为废弃 stub（checkUsage、consumeUsage、getRemainingCount），无引用 |

### 3. 移除冗余文件

| 删除项 | 原因 |
|--------|------|
| `menu-list.js`、`history.js` | 空模板，TypeScript 编译会生成 .js，与 .ts 重复 |
| `dish-detail.js` | 随 dish-detail 页面删除 |

### 4. 配置修正

| 修改项 | 说明 |
|--------|------|
| `app.json` | 移除 dish-detail 页面路由 |
| `project.config.json` | 移除 databaseGuide 条件（页面不存在）；projectname 改为「洋菜单」；移除不存在的 cloudfunctionTemplateRoot |

### 5. 资源引用修正

| 修改项 | 说明 |
|--------|------|
| `app_background.png` | 缺失，改为 CSS 渐变背景（`linear-gradient`） |
| `logo.png` | 缺失，改为 emoji 占位（🍽️），可后续替换为正式 logo |

### 6. 文档同步

- `.cursorrules`：更新架构说明，移除 dish-detail、explainDish、user.ts、dish-card/photo-actions 组件描述

---

## 二、优化后项目结构

```
miniprogram/
├── app.ts / app.json / app.wxss
├── pages/
│   ├── index/           # 首页
│   ├── menu-list/       # 菜品列表
│   └── history/         # 历史记录
├── services/
│   ├── ai.ts
│   ├── cloud.ts
│   └── history.ts
├── utils/
│   └── types.ts
└── images/             # copy.svg, arrow.svg, icons/

cloudfunctions/
├── recognizeMenu/
├── getUserInfo/
└── saveRecord/
```

---

## 三、注意事项

1. **TypeScript 编译**：删除 `menu-list.js`、`history.js` 后，首次构建会从 `.ts` 重新生成，属正常行为。
2. **Logo**：当前使用 emoji 占位，如需品牌 logo，可新增 `/images/logo.png` 并恢复 `<image>` 引用。
3. **背景**：已改为 CSS 渐变，若需图片背景，可新增 `app_background.png` 并恢复 `<image>` 引用。

---

## 四、后续建议

- 定期检查是否有新的未引用导出或页面
- 保持 `.cursorrules` 与代码结构同步
- 若需 dish-detail 单页详情，再按需新增并接入路由
