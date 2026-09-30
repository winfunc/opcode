# 🚨 紧急修复：zh-CN.json 语法错误

> **优先级**: 🔴 最高
> **预计时间**: 5-10 分钟
> **必须完成**: 才能继续翻译工作

## 问题描述

`src/locales/zh-CN.json` 文件中使用了**中文引号** `""`，导致 TypeScript 编译失败。

## 错误信息

```
error TS1005: ',' expected.
error TS1136: Property assignment expected.
```

## 需要修复的精确位置

### 错误 1️⃣: 第 90 行

**位置**: `settings.general.coauthored.label`

```json
❌ 错误:
"label": "包含 "由 Claude 共同编写""

✅ 正确:
"label": "包含 \"由 Claude 共同编写\""
```

---

### 错误 2️⃣: 第 199 行

**位置**: `agents.exportSuccess`

```json
❌ 错误:
"exportSuccess": "代理 "{{name}}" 导出成功"

✅ 正确:
"exportSuccess": "代理 \"{{name}}\" 导出成功"
```

---

### 错误 3️⃣: 第 207 行

**位置**: `agents.deleteDialog.description`

```json
❌ 错误:
"description": "确定要删除代理 "{{name}}" 吗？此操作无法撤消，将永久删除该代理及其所有关联数据。"

✅ 正确:
"description": "确定要删除代理 \"{{name}}\" 吗？此操作无法撤消，将永久删除该代理及其所有关联数据。"
```

---

### 错误 4️⃣: 第 277 行

**位置**: `mcp.serverRemoveSuccess`

```json
❌ 错误:
"serverRemoveSuccess": "服务器 "{{name}}" 删除成功！"

✅ 正确:
"serverRemoveSuccess": "服务器 \"{{name}}\" 删除成功！"
```

---

## 修复方法

### 方法 A: 使用编辑器查找替换（推荐）

1. 打开文件: `C:\Users\zhu\opcode\src\locales\zh-CN.json`

2. 执行查找替换（按顺序）:
   ```
   查找: "
   替换为: \"

   查找: "
   替换为: \"
   ```

3. 保存文件

### 方法 B: 使用命令行工具

```bash
cd C:\Users\zhu\opcode\src\locales

# Windows PowerShell
(Get-Content zh-CN.json -Raw) `
  -replace '"', '\"' `
  -replace '"', '\"' | `
  Set-Content zh-CN.json -NoNewline
```

### 方法 C: 手动修改（不推荐，容易遗漏）

使用文本编辑器逐一修改上述 4 处错误。

---

## 验证修复

### 1. 检查 JSON 格式

```bash
cd C:\Users\zhu\opcode

# 使用 Bun 验证 JSON
"$HOME/.bun/bin/bun.exe" -e "JSON.parse(require('fs').readFileSync('src/locales/zh-CN.json', 'utf-8'))"

# 应该没有输出错误
```

### 2. 尝试构建

```bash
cd C:\Users\zhu\opcode
"$HOME/.bun/bin/bun.exe" run build

# 预期结果：
# ✅ 成功: 构建完成
# ❌ 失败: 检查是否还有其他引号问题
```

---

## 常见错误和解决方法

### 问题: 替换后还有错误

**可能原因**: 可能还有其他中文标点符号

**检查清单**:
- [ ] 中文冒号 `：` → 英文冒号 `:`
- [ ] 中文逗号 `，` → 英文逗号 `,`
- [ ] 中文句号 `。` → 英文句号 `.`（JSON 值中可以保留中文句号）
- [ ] 全角括号 `（）` → 半角括号 `()`（JSON 值中可以保留全角括号）

**注意**: JSON **键和结构**必须使用英文标点，但**值的内容**可以使用中文标点。

### 问题: 不确定是否修复完成

**检查方法**:
```bash
# 搜索文件中的中文引号
grep -n '"' src/locales/zh-CN.json
grep -n '"' src/locales/zh-CN.json

# 应该没有输出（如果有输出，说明还有中文引号）
```

---

## 修复后的完整文件示例

修复后的相关部分应该如下所示：

```json
{
  "settings": {
    "general": {
      "coauthored": {
        "label": "包含 \"由 Claude 共同编写\"",
        "description": "在 git 提交和拉取请求中添加 Claude 署名"
      }
    }
  },
  "agents": {
    "exportSuccess": "代理 \"{{name}}\" 导出成功",
    "deleteDialog": {
      "description": "确定要删除代理 \"{{name}}\" 吗？此操作无法撤消，将永久删除该代理及其所有关联数据。"
    }
  },
  "mcp": {
    "serverRemoveSuccess": "服务器 \"{{name}}\" 删除成功！"
  }
}
```

---

## 检查清单

修复完成后，请确认：

- [ ] 所有 4 处错误已修复
- [ ] JSON 文件格式验证通过
- [ ] 前端构建成功（`bun run build`）
- [ ] 文件已保存
- [ ] Git 提交（如果需要）

---

## 完成标志

当你看到以下输出时，说明修复成功：

```bash
$ bun run build
$ tsc && vite build
✓ built in 4.52s
```

**没有 TypeScript 错误！** ✅

---

## 下一步

修复完成后，可以继续：

1. 测试语言切换功能
2. 开始翻译下一个组件（ProjectList.tsx）
3. 参考 `TRANSLATION_PLAN.md` 继续工作

---

**修复者签名**: ___________
**修复日期**: ___________
**验证者签名**: ___________
