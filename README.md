# 🚀 DelayR - 智能线路测速与跳转系统

DelayR 是一个轻量级的前端智能线路测速与跳转系统，可以帮助您自动检测并选择最佳的服务线路。

## ✨ 特性

- 🎯 多线路并发测速
- 📊 实时延迟显示
- 🔄 自动重试机制
- 🌈 优雅的动画效果
- 📱 响应式设计
- ⚙️ 灵活的配置系统

## 🛠️ 技术栈

- 纯原生JavaScript
- CSS3 动画效果
- YAML配置支持

## 🎨 预览

![预览图](DelayR.webp)

## 📦 安装

1. 克隆仓库：
```bash
git clone https://github.com/KintaMiao/DelayR.git
```
2. 部署到您的Web服务器

## ⚙️ 配置

编辑 config.yaml 文件来自定义您的配置：
```yaml
site:
  title: "Your Smart Routing"
  description: "Your Smart Routing System"

cdnEndpoints:
  - name: "线路1" 
    url: "https://your-cdn-1.com/"
  - name: "线路2"
    url: "https://your-cdn-2.com/"
```

## 🔧 主要参数说明

- timeout: 单次请求超时时间（毫秒）
- attempts: 每个节点测试次数
- maxRetries: 失败后最大重试次数
- retryDelay: 重试间隔时间
- redirectDelay: 跳转延迟时间

## 🌟 使用场景

- CDN线路测速
- 多节点负载均衡
- 访问优化系统
- 服务可用性监控

## 📝 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源协议。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

---

🎉 如果这个项目对您有帮助，请给个 Star！