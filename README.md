# Automated Novel Producer

个性化设计并生产您的小说：
您可以配置章节、写作技巧和语言风格、故事背景、角色、故事线等基础设置。
通过命令实现小说项目创建和管理、创意设计、自动生产、审稿和修改。

使用方式：配置OMO（ohmyopencode）插件，使用/novel-init进行初始化或查看初始化情况。
使用/novel-branch与相关命令查看或创建项目分支，使用/novel-autorun进入intake和plan环节得到小说基本要求后跳转入自动生产环节。

## Install Into Another OpenCode Project

Preview the deployment:

```bash
curl -fsSL https://raw.githubusercontent.com/Okabe8832/Automated-novel-producer-release/main/install.sh | bash -s -- /path/to/target-project
```

Apply the deployment:

```bash
curl -fsSL https://raw.githubusercontent.com/Okabe8832/Automated-novel-producer-release/main/install.sh | bash -s -- /path/to/target-project --write
```
