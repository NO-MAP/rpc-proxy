# 🚀 npm 发布检查清单

## ✅ 当前状态

所有预发布检查已通过！

```
✅ Dist directory exists
✅ Main entry point exists
✅ Type definitions exist
✅ package.json is complete
✅ README.md exists
✅ TypeScript compilation successful
✅ Only dist files will be published
```

## 📋 发布前待办事项

### 1. ⚠️ 更新 package.json 信息

当前 `package.json` 中包含占位符，需要更新：

```json
{
  "author": {
    "name": "Your Name",           // ← 填写您的名字
    "email": "your.email@example.com"  // ← 填写您的邮箱
  },
  "repository": {
    "url": "https://github.com/NO-MAP/rpc-proxy"  // ← 更新为实际仓库
  },
  "bugs": {
    "url": "https://github.com/NO-MAP/rpc-proxy/issues"  // ← 更新为实际仓库
  },
  "homepage": "https://github.com/NO-MAP/rpc-proxy#readme"  // ← 更新为实际仓库
}
```

**建议修改为：**
- 如果没有 GitHub 仓库，可以删除 `repository` 和 `bugs` 字段
- 或者创建一个 GitHub 仓库并更新 URL

### 2. 🔐 解决 npm 2FA 问题

**当前错误：**
```
403 Forbidden - Two-factor authentication required
```

**解决方案（选择一个）：**

#### 方案 A: 使用访问令牌（推荐，最简单）

1. 访问 https://www.npmjs.com/settings/tokens
2. 点击 "Generate New Token"
3. 选择 "Automation" 类型
4. 复制生成的令牌
5. 使用令牌登录：

```bash
npm logout
npm login --registry=https://registry.npmjs.org/
# Username: your-username
# Password: paste-your-token-here
# Email: your-email@example.com
```

#### 方案 B: 启用 2FA 并使用 OTP

1. 在 npm 设置中启用 2FA
2. 发布时使用：

```bash
npm publish --otp=123456
```

### 3. 📦 检查包名是否可用

```bash
npm search node-ipc-rpc-proxy
```

如果包名已被占用，可以考虑：
- `typed-rpc-proxy`
- `async-rpc-proxy`
- `@yourusername/rpc-proxy`

## 🎯 发布步骤

### 选项 1: 标准发布

```bash
# 1. 更新 package.json 信息
# 编辑 package.json

# 2. 登录 npm（如果使用访问令牌）
npm login --registry=https://registry.npmjs.org/

# 3. 运行预发布检查
npm run prepublish-check

# 4. 预览包内容
npm pack --dry-run

# 5. 发布
npm publish

# 如果需要 OTP
npm publish --otp=123456
```

### 选项 2: 自动发布（推荐）

`package.json` 已配置 `prepublishOnly` 钩子，会自动：

1. 构建项目
2. 运行预发布检查

所以只需：

```bash
npm publish
```

## 📊 包内容预览

```
📦 node-ipc-rpc-proxy@1.0.0

包含文件：
✅ README.md (13.1 kB)
✅ dist/child.d.ts (2.5 kB)
✅ dist/child.js (3.1 kB)
✅ dist/index.d.ts (523 B)
✅ dist/index.js (2.9 kB)
✅ dist/parent.d.ts (4.5 kB)
✅ dist/parent.js (5.3 kB)
✅ dist/rpc-core.d.ts (2.4 kB)
✅ dist/rpc-core.js (9.5 kB)
✅ dist/rpc-proxy.d.ts (1.7 kB)
✅ dist/rpc-proxy.js (2.8 kB)
✅ dist/types.d.ts (3.4 kB)
✅ dist/types.js (536 B)
✅ dist/utils.d.ts (1.5 kB)
✅ dist/utils.js (1.5 kB)
```

## ✨ 包的特性

- ✅ 零依赖
- ✅ 完整的 TypeScript 类型定义
- ✅ 支持 Node.js >= 14.0.0
- ✅ MIT 许可证
- ✅ 完整的文档和示例

## 🧪 发布后验证

发布成功后，在新目录中测试：

```bash
cd /tmp
mkdir test-rpc
cd test-rpc
npm init -y
npm install node-ipc-rpc-proxy
```

创建测试文件：

```typescript
// test.ts
import { createParentRPC } from 'node-ipc-rpc-proxy';

// 应该有完整的类型提示
console.log('Package installed successfully!');
```

## 📚 参考文档

- [完整发布指南](PUBLISHING_GUIDE.md) - 详细的发布步骤和问题解决
- [README.md](README.md) - 包的使用文档
- [QUICKSTART.md](QUICKSTART.md) - 快速开始指南

## 🎉 准备就绪！

只需完成上述3个待办事项，就可以发布了！

**最简单的发布流程：**

```bash
# 1. 更新 package.json 中的作者信息
# 2. 使用访问令牌登录 npm
npm login --registry=https://registry.npmjs.org/

# 3. 发布
npm publish
```

祝发布顺利！🚀
