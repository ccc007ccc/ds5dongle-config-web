# M61 DualSense 配置器

[English](README.md)

这是 M61 BL616/BL618 DualSense 蓝牙转 USB 固件的 WebHID 配置与诊断工具。

本仓库完全针对 M61 固件和硬件。

## 使用配置器

请用 Chrome、Edge 或其他 Chromium 内核浏览器打开
<https://ds5.766677.xyz/>。WebHID 必须运行在 HTTPS
页面（本地开发时也可使用 `localhost`）。

1. 连接并启动 M61，点击“连接设备”，选择 M61 DualSense USB 设备。
2. 修改前先读取开发板中的当前配置。
3. 只调整需要的项目，然后点击“保存配置”；固件会把完整配置持久化到 Flash。
4. 如果页面提示某项设置需要重连或重启，请重新连接手柄或复位 M61。

M61复用了Sony USB身份，因此浏览器选择器中也可能出现真实的有线DualSense。页面会在
所选设备返回有效的版本化`M61C`配置报告后才解锁所有控件；非M61设备会被关闭，不会
向其发送配置命令。

正式默认值刻意采用稳定配置：麦克风输入关闭、CPU 为 320 MHz、超频关闭、摇杆死区
为 0%。麦克风解码和超频都会明显增加负载并可能导致卡顿，因此启用前 WebUI 会明确
提醒。USB 回报模式包括实时转发、实测固定 250 Hz 和实测固定 500 Hz；固定回报不会
提高蓝牙手柄本身的原始采样率。

当前支持目标是普通DualSense；DualSense Edge未支持、也没有进行真机验收。

当前网页可配置音频路由、手柄音频缓冲提示、触觉增益、硬件PWM状态灯亮度、安全CPU
档位、手动摇杆死区、250/500 Hz USB回报模式、手柄空闲和主机挂起电源策略，并提供
配对/断开/忘记/关机、Flash持久化及有界诊断导出。死区面板直接订阅现有USB HID输入流，
把250/500 Hz事件合并为每个屏幕刷新帧最多绘制一次，不轮询Feature Report，也不增加
固件通信。网页不提供固件刷写；请按固件仓库的UART ISP文档操作。

## 本地开发与验证

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm build
```

可用 `corepack pnpm preview`预览正式构建。连接的固件必须支持 M61 管理报告
`0xF6` 到 `0xF9`。

## 部署

每次推送到 `master` 都会自动运行测试、构建静态页面，并把 `dist/` 发布到
`gh-pages` 分支。GitHub Pages 从该分支根目录提供页面，并持续保留
`ds5.766677.xyz` 自定义域名记录。Vite 使用相对资源地址，因此自定义域名和 GitHub
项目页面入口都可以正常加载。

固件源码、Release文件、接线、协议和已知限制统一维护在
[DS5Dongle仓库](https://github.com/ccc007ccc/DS5Dongle)。
