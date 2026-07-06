# 中级经济师 · 刷题工具

基于 HTML/CSS/JS 的中级经济师考试刷题工具，支持单选、多选、案例题，含错题本与收藏功能。

## 在线访问

https://cnihp.github.io/zhongji-jingjishi-shuati/

## Cloudflare D1 云同步

项目默认使用浏览器本地存储。若要让同一个昵称在手机和电脑之间同步进度，可以部署 `cloudflare/worker.js` 到 Cloudflare Workers，并绑定 D1 数据库。

### 部署步骤

1. 安装并登录 Wrangler：

```bash
npm install -g wrangler
wrangler login
```

2. 创建 D1 数据库：

```bash
wrangler d1 create zhongji-jingjishi-shuati
```

3. 复制配置模板：

```powershell
Copy-Item wrangler.example.toml wrangler.toml
```

将 `wrangler.toml` 里的 `database_id` 替换为上一步返回的数据库 ID。

4. 初始化数据表：

```bash
wrangler d1 execute zhongji-jingjishi-shuati --file=cloudflare/schema.sql --remote
```

5. 发布 Worker：

```bash
wrangler deploy
```

6. 在 `index.html` 中设置 Worker 地址：

```js
const CLOUD_SYNC_API = 'https://你的-worker.你的账号.workers.dev';
```

也可以临时在浏览器控制台设置：

```js
localStorage.setItem('cloudSyncApi', 'https://你的-worker.你的账号.workers.dev');
```

设置后，用户输入同一个昵称即可跨设备同步答题进度和错题记录。
