# Roblox Games Hub 后端 API

Roblox API 代理服务，部署在 Render 上。

## 部署到 Render

1. 登录 [Render](https://render.com)
2. 点击 **New** → **Web Service**
3. 连接 GitHub 仓库 `GGG792/roblox-backend`
4. 配置：
   - **Name**: `roblox-backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free
5. 点击 **Create Web Service**
6. 等待部署完成，获取 URL（例如 `https://roblox-backend.onrender.com`）

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/user/lookup` | 用户名 → 用户ID |
| GET | `/api/user/:userId` | 用户详细信息 |
| GET | `/api/user/:userId/headshot` | 头像头部图片 |
| GET | `/api/user/:userId/avatar-full` | 全身头像图片 |
| GET | `/api/user/:userId/avatar-info` | 装扮详情 |
| GET | `/api/user/:userId/profile` | 完整用户资料（聚合） |
| GET | `/api/games/:universeIds` | 游戏详情 |
| GET | `/api/games/:universeId/icons` | 游戏图标 |
| GET | `/api/games/:universeId/thumbnails` | 游戏缩略图 |
| GET | `/api/search/games?query=xxx` | 搜索游戏 |
| GET | `/api/search/users?keyword=xxx` | 搜索用户 |
| GET | `/api/place/:placeId/universe` | Place ID → Universe ID |

## 使用示例

```bash
# 查找用户
curl -X POST https://your-app.onrender.com/api/user/lookup \
  -H "Content-Type: application/json" \
  -d '{"username": "Roblox"}'

# 获取完整资料
curl https://your-app.onrender.com/api/user/1/profile

# 搜索游戏
curl "https://your-app.onrender.com/api/search/games?query=Brookhaven"
```

## 特性

- CORS 全开放，支持任意前端调用
- 60 秒缓存，减少 API 请求
- 聚合接口，一次请求获取所有用户数据
- 无需认证，纯公开 API 代理
