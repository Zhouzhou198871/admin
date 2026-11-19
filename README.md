# 晴天账号铺管理后台

独立管理端仓库：`Zhouzhou198871/admin`

## 自动构建与部署

- 默认分支：`main`
- CI：GitHub Actions（`.github/workflows/deploy.yml`）
- 发布：GitHub Pages
- 预期访问地址：<https://zhouzhou198871.github.io/admin/>

每次向 `main` 推送都会校验 JavaScript、构建静态站点并部署 Pages。

## 当前已接通

- Worker 健康检查：`GET /health`
- 用户余额充值：`POST /api/admin/credit`
- 鉴权请求头：`X-Admin-Key`
- API 基址：`https://qingtian-shop-api.chulingli1988.workers.dev`

管理密钥由管理员在充值页面手动输入，仅保存在当前页面内存中，不提交到 GitHub，不写入 localStorage。

## 当前尚未开放的后台能力

现有商城 Worker 仅提供面向已登录用户的个人订单、商品接口，以及管理员余额充值接口；尚无管理员用户列表、全站订单列表、商品编辑和库存管理接口。因此这些模块明确标记为待接入，不伪造统计数据，也不使用普通用户接口绕过权限。

## 安全边界

- 不在前端保存 ADMIN_API_KEY。
- 不直接连接 D1 数据库。
- 不把 SMTP、供应商会话、采购密钥或其他服务器密钥写入本仓库。
- 新增管理能力必须由后端提供专用管理员鉴权与权限校验接口。
