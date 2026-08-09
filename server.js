const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 10000;

// ===== 中间件 =====
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ===== Roblox API 配置 =====
const ROBLOX_API = {
  // 用户名 -> 用户ID
  usernames: 'https://users.roblox.com/v1/usernames/users',
  // 用户详细信息
  user: (uid) => `https://users.roblox.com/v1/users/${uid}`,
  // 用户搜索
  search: (keyword) => `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=10`,
  // 头像头部
  headshot: (uid) => `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=420x420&format=Png&isCircular=false`,
  // 全身头像
  fullAvatar: (uid) => `https://thumbnails.roblox.com/v1/users/avatar?userIds=${uid}&size=420x420&format=Png&isCircular=false`,
  // 半身头像
  bust: (uid) => `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${uid}&size=420x420&format=Png&isCircular=false`,
  // 头像详情（穿着物品）
  avatar: (uid) => `https://avatar.roblox.com/v1/users/${uid}/avatar`,
  // 当前穿着
  currentlyWearing: (uid) => `https://avatar.roblox.com/v1/users/${uid}/currently-wearing`,
  // 游戏详情
  games: (ids) => `https://games.roblox.com/v1/games?universeIds=${ids}`,
  // 游戏图标
  gameIcons: (ids) => `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids}&size=512x512&format=Png&isCircular=false`,
  // 游戏缩略图
  gameThumbnails: (uid) => `https://thumbnails.roblox.com/v1/games/${uid}/thumbnails`,
  // 游戏媒体
  gameMedia: (uid) => `https://games.roblox.com/v2/games/${uid}/media`,
  // 搜索游戏
  searchGames: (query) => `https://apis.roblox.com/search-api/omni-search?SearchQuery=${encodeURIComponent(query)}&SessionId=backend-${Date.now()}`,
  // Place ID -> Universe ID
  placeToUniverse: (pid) => `https://apis.roblox.com/universes/v1/places/${pid}/universe`
};

// ===== 工具函数：发起 HTTPS 请求 =====
function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        ...options.headers
      }
    };

    if (options.body) {
      requestOptions.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          reject(new Error(`JSON解析失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('请求超时')); });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// ===== 简易缓存 =====
const cache = new Map();
const CACHE_TTL = 60000; // 60秒

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < CACHE_TTL) {
    return item.data;
  }
  return null;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
  // 清理过期缓存
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.time > CACHE_TTL) cache.delete(k);
    }
  }
}

// ===== 路由 =====

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'Roblox Games Hub API',
    version: '1.0.0',
    endpoints: [
      'GET /health',
      'POST /api/user/lookup - 用户名查用户ID',
      'GET /api/user/:userId - 用户详细信息',
      'GET /api/user/:userId/headshot - 头像头部',
      'GET /api/user/:userId/avatar-full - 全身头像',
      'GET /api/user/:userId/avatar-info - 装扮详情',
      'GET /api/user/:userId/profile - 完整用户资料(聚合)',
      'GET /api/games/:universeIds - 游戏详情',
      'GET /api/games/:universeId/icons - 游戏图标',
      'GET /api/games/:universeId/thumbnails - 游戏缩略图',
      'GET /api/search/games?query=xxx - 搜索游戏',
      'GET /api/search/users?keyword=xxx - 搜索用户'
    ]
  });
});

// ===== 用户名 -> 用户ID =====
app.post('/api/user/lookup', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: '请提供 username' });
    }

    const cacheKey = `lookup_${username}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.usernames, {
      method: 'POST',
      body: { usernames: [username], excludeBannedUsers: true }
    });

    if (result.status !== 200 || !result.data.data || result.data.data.length === 0) {
      return res.status(404).json({ error: `找不到用户: ${username}` });
    }

    setCached(cacheKey, result.data.data[0]);
    res.json(result.data.data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 用户详细信息 =====
app.get('/api/user/:userId', async (req, res) => {
  try {
    const uid = req.params.userId;
    const cacheKey = `user_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.user(uid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取用户信息失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 头像头部 =====
app.get('/api/user/:userId/headshot', async (req, res) => {
  try {
    const uid = req.params.userId;
    const cacheKey = `headshot_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.headshot(uid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取头像失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 全身头像 =====
app.get('/api/user/:userId/avatar-full', async (req, res) => {
  try {
    const uid = req.params.userId;
    const cacheKey = `avatarfull_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.fullAvatar(uid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取全身头像失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 装扮详情 =====
app.get('/api/user/:userId/avatar-info', async (req, res) => {
  try {
    const uid = req.params.userId;
    const cacheKey = `avatarinfo_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.avatar(uid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取装扮信息失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 完整用户资料（聚合接口） =====
app.get('/api/user/:userId/profile', async (req, res) => {
  try {
    const uid = req.params.userId;
    const cacheKey = `profile_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    // 并行请求所有数据
    const [userResp, headshotResp, fullAvatarResp, avatarResp] = await Promise.all([
      fetchJSON(ROBLOX_API.user(uid)),
      fetchJSON(ROBLOX_API.headshot(uid)),
      fetchJSON(ROBLOX_API.fullAvatar(uid)),
      fetchJSON(ROBLOX_API.avatar(uid))
    ]);

    const profile = {
      user: userResp.data,
      headshot: headshotResp.data,
      fullAvatar: fullAvatarResp.data,
      avatar: avatarResp.data
    };

    setCached(cacheKey, profile);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 游戏详情 =====
app.get('/api/games/:universeIds', async (req, res) => {
  try {
    const ids = req.params.universeIds;
    const cacheKey = `games_${ids}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.games(ids));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取游戏信息失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 游戏图标 =====
app.get('/api/games/:universeId/icons', async (req, res) => {
  try {
    const uid = req.params.universeId;
    const cacheKey = `gameicons_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.gameIcons(uid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取游戏图标失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 游戏缩略图 =====
app.get('/api/games/:universeId/thumbnails', async (req, res) => {
  try {
    const uid = req.params.universeId;
    const cacheKey = `gamethumbs_${uid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.gameThumbnails(uid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '获取游戏缩略图失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 搜索游戏 =====
app.get('/api/search/games', async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: '请提供 query 参数' });
    }

    const cacheKey = `searchgames_${query}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.searchGames(query));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '搜索游戏失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 搜索用户 =====
app.get('/api/search/users', async (req, res) => {
  try {
    const keyword = req.query.keyword;
    if (!keyword) {
      return res.status(400).json({ error: '请提供 keyword 参数' });
    }

    const cacheKey = `searchusers_${keyword}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.search(keyword));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '搜索用户失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Place ID -> Universe ID =====
app.get('/api/place/:placeId/universe', async (req, res) => {
  try {
    const pid = req.params.placeId;
    const cacheKey = `place2uni_${pid}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json(cached);

    const result = await fetchJSON(ROBLOX_API.placeToUniverse(pid));
    if (result.status !== 200) {
      return res.status(result.status).json({ error: '转换失败' });
    }

    setCached(cacheKey, result.data);
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 启动服务器 =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Roblox Backend API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
