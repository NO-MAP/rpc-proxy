# npm 发布指南

## 准备工作

### 1. 完善 package.json 信息

在 `package.json` 中填写您的信息：

```json
{
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/rpc-proxy"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/rpc-proxy/issues"
  },
  "homepage": "https://github.com/YOUR_USERNAME/rpc-proxy#readme"
}
```

### 2. 检查 npm 账户

确保您已登录 npm：

```bash
npm whoami
```

如果未登录：

```bash
npm login
```

## 解决 2FA 问题

您遇到的错误是因为 npm 现在要求双因素认证（2FA）。有以下几种解决方案：

### 方案 1: 启用 2FA（推荐）

1. 访问 https://www.npmjs.com/settings
2. 在 "Authentication" 部分启用 2FA
3. 选择：
   - **Auth-only 2FA**: 只在发布和管理包时需要
   - **Auth and writes 2FA**: 发布和安装时都需要

### 方案 2: 使用访问令牌

1. 生成访问令牌：
   - 访问 https://www.npmjs.com/settings/tokens
   - 点击 "Generate New Token"
   - 选择 "Automation" 类型（可以绕过 2FA）
   - 复制生成的令牌

2. 使用令牌登录：

```bash
# 使用令牌代替密码
npm login --registry=https://registry.npmjs.org/
# Username: your-username
# Password: your-automation-token
# Email: your-email@example.com
```

3. 或者将令牌添加到 `.npmrc`：

```bash
# 在用户目录创建 .npmrc 文件
echo "//registry.npmjs.org/:_authToken=YOUR_TOKEN_HERE" > ~/.npmrc
```

### 方案 3: 使用 `npm OTP`（临时方案）

如果已启用 2FA，发布时需要输入 OTP：

```bash
npm publish --otp=123456
```

## 发布前检查清单

### 1. 构建项目

```bash
npm run build
```

### 2. 检查输出文件

```bash
ls -la dist/
```

应该看到：
- `index.js`
- `index.d.ts`
- 其他 `.js` 和 `.d.ts` 文件

### 3. 检查包内容（预览）

```bash
npm pack --dry-run
```

这会显示将要发布的所有文件，但不实际发布。

### 4. 测试本地包

```bash
# 在另一个目录测试
cd /tmp/test-rpc-proxy
npm init -y
npm install ../path/to/rpc-proxy
```

## 发布步骤

### 标准发布流程

```bash
# 1. 确保一切已提交
git add .
git commit -m "Prepare for release"

# 2. 构建项目
npm run build

# 3. 检查版本号
npm version patch  # 或 minor, major

# 4. 发布到 npm
npm publish

# 如果需要 OTP
npm publish --otp=123456

# 或使用访问令牌
npm publish
```

### 首次发布

```bash
# 1. 检查包名是否可用
npm search node-ipc-rpc-proxy

# 2. 构建项目
npm run build

# 3. 预览包内容
npm pack --dry-run

# 4. 发布
npm publish --access public
```

注意：首次发布 scoped 包（如 `@username/package`）需要 `--access public`。
非 scoped 包（如 `node-ipc-rpc-proxy`）默认就是 public。

## 发布后验证

### 1. 在 npm 上查看

访问：https://www.npmjs.com/package/node-ipc-rpc-proxy

### 2. 测试安装

```bash
# 在新目录中测试
cd /tmp
mkdir test-rpc
cd test-rpc
npm init -y
npm install node-ipc-rpc-proxy
```

### 3. 验证类型定义

```typescript
import { createParentRPC } from 'node-ipc-rpc-proxy';
// 应该有自动完成和类型提示
```

## 常见问题

### Q: 发布时提示 "403 Forbidden"

**A:** 可能原因：
1. 包名已被占用 → 更换包名
2. 需要 2FA → 使用 `--otp` 参数或访问令牌
3. 没有发布权限 → 确保使用正确的账户

### Q: 包名已被占用

**A:** 有几个选择：
1. 使用 scoped 包：`@username/rpc-proxy`
2. 修改包名：`yourname-node-ipc-rpc-proxy`
3. 添加后缀：`node-ipc-rpc-proxy-ts`

### Q: 类型定义没有发布

**A:** 检查 `package.json`：
```json
{
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

### Q: 发布后找不到模块

**A:** 检查 `package.json`：
```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

## 版本管理

使用语义化版本（Semantic Versioning）：

```bash
# 修复 bug，向后兼容
npm version patch  # 1.0.0 → 1.0.1

# 新功能，向后兼容
npm version minor  # 1.0.1 → 1.1.0

# 重大变更，可能不兼容
npm version major  # 1.1.0 → 2.0.0
```

## 撤销发布（紧急情况）

⚠️ **警告**: 撤销发布可能会破坏依赖此包的其他项目

```bash
# 撤销特定版本（24小时内）
npm unpublish node-ipc-rpc-proxy@1.0.0

# 撤销整个包（不推荐）
npm unpublish node-ipc-rpc-proxy --force
```

## CI/CD 自动发布（可选）

可以使用 GitHub Actions 自动发布：

```yaml
# .github/workflows/publish.yml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 当前状态

您的项目已经准备就绪：

- ✅ TypeScript 编译成功
- ✅ 类型定义完整
- ✅ 文档齐全
- ✅ 示例代码完整
- ✅ 零依赖

只需：
1. 完善 `package.json` 中的作者信息
2. 解决 npm 2FA 问题
3. 运行 `npm publish`

## 建议的包名

如果 `node-ipc-rpc-proxy` 已被占用，可以考虑：

- `typed-rpc-proxy`
- `node-ipc-proxy`
- `@yourusername/rpc-proxy`
- `async-rpc-proxy`
- `ts-rpc-proxy`
- `process-rpc`

## 发布成功后

1. **更新 README**：添加 npm badge

```markdown
[![npm version](https://badge.fury.io/js/node-ipc-rpc-proxy.svg)](https://www.npmjs.com/package/node-ipc-rpc-proxy)
[![Downloads](https://img.shields.io/npm/dm/node-ipc-rpc-proxy.svg)](https://www.npmjs.com/package/node-ipc-rpc-proxy)
```

2. **创建 GitHub Release**：标记版本和发布说明

3. **通知用户**：在社交媒体、博客等分享

祝发布顺利！🎉
