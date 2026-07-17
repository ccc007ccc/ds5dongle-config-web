# M61 DualSense 配置器

[English](README.md)

这是 M61 BL616/BL618 DualSense 蓝牙转 USB 固件的 WebHID 配置与诊断工具。

本仓库完全针对 M61 固件和硬件。

## 开发

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm build
```

请使用 Chromium 内核浏览器，并通过 HTTPS 或 `localhost` 打开。连接的固件必须
支持 M61 管理报告 `0xF6` 到 `0xF9`。

参见[迁移规格](docs/M61_WEB_REFACTOR_SPEC.zh-CN.md)和
[功能矩阵](docs/M61_FEATURE_GAP_MATRIX.csv)。
