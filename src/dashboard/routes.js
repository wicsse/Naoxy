const express = require("express");
const session = require("express-session");
const axios = require("axios");
const router = express.Router();

module.exports = (client, app) => {

  app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 8 }
  }));

  function requireAuth(req, res, next) {
    if (req.session?.user) return next();
    res.redirect("/login");
  }

  // Login page
  app.get("/login", (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orbis Login</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;}
    .card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:40px;text-align:center;width:340px;}
    .logo{width:60px;height:60px;background:#7c3aed;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;margin:0 auto 20px;}
    h1{font-size:22px;margin-bottom:8px;}p{color:#7c6fa0;font-size:13px;margin-bottom:28px;}
    a{display:block;background:#5865f2;color:#fff;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;}
    a:hover{background:#4752c4;}</style></head>
    <body><div class="card"><div class="logo">O</div><h1>Orbis Dashboard</h1><p>Connecte-toi avec Discord pour gérer ton serveur</p>
    <a href="/auth/discord">🔐 Se connecter avec Discord</a></div></body></html>`);
  });

  // OAuth2 Discord
  app.get("/auth/discord", (req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: (process.env.DASHBOARD_URL || "http://localhost:3001") + "/auth/callback",
      response_type: "code",
      scope: "identify guilds",
    });
    res.redirect("https://discord.com/oauth2/authorize?" + params.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/login");
    try {
      const tokenRes = await axios.post("https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: (process.env.DASHBOARD_URL || "http://localhost:3001") + "/auth/callback",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const token = tokenRes.data.access_token;
      const userRes = await axios.get("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token } });
      const guildsRes = await axios.get("https://discord.com/api/users/@me/guilds", { headers: { Authorization: "Bearer " + token } });
      req.session.user = { ...userRes.data, guilds: guildsRes.data, token };
      res.redirect("/servers");
    } catch (e) {
      console.error("[OAuth]", e.message);
      res.redirect("/login?error=1");
    }
  });

  app.get("/auth/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
  });

  // Sélection du serveur
  app.get("/servers", requireAuth, (req, res) => {
    const userGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x20) === 0x20);
    const botGuilds = client.guilds.cache;
    const mutual = userGuilds.filter(g => botGuilds.has(g.id));
    const notIn = userGuilds.filter(g => !botGuilds.has(g.id));
    const cards = (guilds, hasBot) => guilds.map(g => {
      const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null;
      return `<div class="server-card ${hasBot ? '' : 'no-bot'}">
        <div class="server-icon">${icon ? `<img src="${icon}">` : g.name[0]}</div>
        <div class="server-name">${g.name}</div>
        ${hasBot
          ? `<a href="/dashboard/${g.id}" class="btn-manage">Gérer</a>`
          : `<a href="https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot&permissions=8&guild_id=${g.id}" class="btn-add" target="_blank">Ajouter</a>`}
      </div>`;
    }).join('');

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orbis — Serveurs</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:sans-serif;min-height:100vh;}
    .topbar{background:#0e0a1a;border-bottom:1px solid rgba(124,58,237,0.15);padding:16px 32px;display:flex;align-items:center;justify-content:space-between;}
    .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;}
    .logo-icon{width:32px;height:32px;background:#7c3aed;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;}
    .user{display:flex;align-items:center;gap:10px;font-size:13px;color:#7c6fa0;}
    .user img{width:28px;height:28px;border-radius:50%;}
    .logout{color:#7c6fa0;text-decoration:none;font-size:12px;border:1px solid rgba(124,58,237,0.2);padding:4px 10px;border-radius:6px;}
    .content{max-width:1000px;margin:0 auto;padding:40px 24px;}
    h2{font-size:20px;margin-bottom:6px;}p{color:#7c6fa0;font-size:13px;margin-bottom:24px;}
    .section-title{font-size:12px;color:#4a4060;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:12px;}
    .servers-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:32px;}
    .server-card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.15);border-radius:12px;padding:20px;text-align:center;transition:border-color .2s;}
    .server-card:hover{border-color:rgba(124,58,237,0.4);}
    .server-card.no-bot{opacity:0.6;}
    .server-icon{width:56px;height:56px;border-radius:14px;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin:0 auto 12px;overflow:hidden;}
    .server-icon img{width:100%;height:100%;object-fit:cover;border-radius:14px;}
    .server-name{font-size:13px;font-weight:500;margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .btn-manage{display:block;background:#7c3aed;color:#fff;padding:8px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;}
    .btn-manage:hover{background:#6d28d9;}
    .btn-add{display:block;background:rgba(124,58,237,0.1);color:#a78bfa;padding:8px;border-radius:6px;text-decoration:none;font-size:12px;border:1px solid rgba(124,58,237,0.2);}
    </style></head>
    <body>
    <div class="topbar">
      <div class="logo"><div class="logo-icon">O</div> Orbis Dashboard</div>
      <div class="user">
        <img src="https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png" onerror="this.style.display='none'">
        ${req.session.user.username}
        <a href="/auth/logout" class="logout">Déconnexion</a>
      </div>
    </div>
    <div class="content">
      <h2>Tes serveurs</h2>
      <p>Sélectionne un serveur à gérer. Le bot doit être présent pour accéder au dashboard.</p>
      <div class="section-title">✅ Bot présent (${mutual.length})</div>
      <div class="servers-grid">${cards(mutual, true)}</div>
      ${notIn.length ? `<div class="section-title">➕ Ajouter le bot (${notIn.length})</div><div class="servers-grid">${cards(notIn, false)}</div>` : ''}
    </div></body></html>`);
  });

  // Dashboard pour un serveur
  app.get("/dashboard/:guildId", requireAuth, (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect("/servers");
    const userGuild = req.session.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20) return res.redirect("/servers");
    res.sendFile(require("path").join(__dirname, "public/index.html"));
  });

  // API
  router.get("/api/guilds", requireAuth, (req, res) => {
    const userGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x20) === 0x20);
    res.json(client.guilds.cache.filter(g => userGuilds.some(ug => ug.id === g.id)).map(g => g.id));
  });

  router.get("/api/guild/:id", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ error: "Serveur introuvable" });
    await guild.fetch();
    res.json({
      id: guild.id, name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      memberCount: guild.memberCount,
      onlineCount: guild.members.cache.filter(m => m.presence?.status === "online").size,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
    });
  });

  router.get("/api/guild/:id/members", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ error: "Serveur introuvable" });
    await guild.members.fetch();
    res.json(guild.members.cache.map(m => ({
      id: m.id, username: m.user.username,
      avatar: m.user.displayAvatarURL({ size: 64 }),
      roles: m.roles.cache.filter(r => r.id !== guild.id).sort((a,b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
      joinedAt: m.joinedAt, bot: m.user.bot,
    })));
  });

  router.get("/api/guild/:id/roles", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ error: "Serveur introuvable" });
    res.json(guild.roles.cache.filter(r => r.id !== guild.id).sort((a,b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor, memberCount: r.members.size, position: r.position })));
  });

  router.get("/api/guild/:id/channels", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json({ error: "Serveur introuvable" });
    res.json(guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId })));
  });

  return router;
};
