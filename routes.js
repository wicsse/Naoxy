const express = require("express");
const session = require("express-session");
const axios = require("axios");
const path = require("path");
const router = express.Router();
const { db, getGuildSettings } = require("../database/db.js");

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

  function requireGuildAccess(req, res, next) {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const userGuild = req.session.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20)
      return res.status(403).json({ error: "Accès refusé" });
    req.guild = guild;
    next();
  }

  // ─── Auth ───────────────────────────────────────────────
  app.get("/login", (req, res) => {
    if (req.session?.user) return res.redirect("/servers");
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orbis Login</title>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background-image:radial-gradient(ellipse at 20% 50%,rgba(124,58,237,0.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(124,58,237,0.05) 0%,transparent 50%);}
    .card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.25);border-radius:20px;padding:48px 40px;text-align:center;width:360px;box-shadow:0 0 60px rgba(124,58,237,0.1);}
    .logo{width:64px;height:64px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border-radius:16px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:26px;font-weight:700;margin:0 auto 24px;box-shadow:0 8px 32px rgba(124,58,237,0.4);}
    h1{font-family:'Syne',sans-serif;font-size:24px;margin-bottom:8px;}
    p{color:#7c6fa0;font-size:13px;margin-bottom:32px;line-height:1.6;}
    a{display:flex;align-items:center;justify-content:center;gap:10px;background:#5865f2;color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;transition:all .2s;}
    a:hover{background:#4752c4;transform:translateY(-1px);box-shadow:0 8px 24px rgba(88,101,242,0.4);}
    .err{color:#f87171;font-size:12px;margin-top:16px;}</style></head>
    <body><div class="card">
      <div class="logo">O</div>
      <h1>Orbis Dashboard</h1>
      <p>Connecte-toi avec Discord pour gérer ton serveur</p>
      <a href="/auth/discord"><svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="white"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/></svg> Se connecter avec Discord</a>
      ${req.query.error ? '<div class="err">❌ Erreur de connexion, réessaie.</div>' : ''}
    </div></body></html>`);
  });

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
      const [userRes, guildsRes] = await Promise.all([
        axios.get("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token } }),
        axios.get("https://discord.com/api/users/@me/guilds", { headers: { Authorization: "Bearer " + token } }),
      ]);
      req.session.user = { ...userRes.data, guilds: guildsRes.data, token };
      res.redirect("/servers");
    } catch (e) {
      console.error("[OAuth]", e.message);
      res.redirect("/login?error=1");
    }
  });

  app.get("/auth/logout", (req, res) => { req.session.destroy(); res.redirect("/login"); });

  // ─── Servers page ────────────────────────────────────────
  app.get("/servers", requireAuth, (req, res) => {
    const userGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x20) === 0x20);
    const botGuilds = client.guilds.cache;
    const mutual = userGuilds.filter(g => botGuilds.has(g.id));
    const notIn = userGuilds.filter(g => !botGuilds.has(g.id));
    const avatarUrl = req.session.user.avatar
      ? `https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/0.png`;
    const card = (g, hasBot) => {
      const icon = g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">` : g.name[0];
      return `<div class="server-card${hasBot ? '' : ' dim'}">
        <div class="server-icon">${icon}</div>
        <div class="server-name">${g.name}</div>
        ${hasBot
          ? `<a href="/dashboard/${g.id}" class="btn-primary">Gérer →</a>`
          : `<a href="https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot&permissions=8&guild_id=${g.id}" class="btn-add" target="_blank">+ Ajouter</a>`}
      </div>`;
    };
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orbis — Serveurs</title>
    <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:'DM Sans',sans-serif;min-height:100vh;}
    .topbar{background:#0e0a1a;border-bottom:1px solid rgba(124,58,237,0.15);padding:0 32px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;}
    .logo{display:flex;align-items:center;gap:10px;font-family:'Syne',sans-serif;font-weight:700;font-size:18px;}
    .logo-icon{width:32px;height:32px;background:linear-gradient(135deg,#7c3aed,#a78bfa);border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;}
    .user{display:flex;align-items:center;gap:10px;font-size:13px;}
    .user img{width:30px;height:30px;border-radius:50%;border:2px solid rgba(124,58,237,0.4);}
    .logout{color:#7c6fa0;text-decoration:none;font-size:12px;border:1px solid rgba(124,58,237,0.2);padding:5px 12px;border-radius:6px;transition:all .2s;}
    .logout:hover{border-color:rgba(124,58,237,0.5);color:#a78bfa;}
    .content{max-width:1100px;margin:0 auto;padding:48px 24px;}
    .hero{margin-bottom:40px;}
    h2{font-family:'Syne',sans-serif;font-size:28px;margin-bottom:6px;}
    .sub{color:#7c6fa0;font-size:14px;}
    .section-label{font-size:11px;color:#4a4060;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
    .section-label::after{content:'';flex:1;height:1px;background:rgba(124,58,237,0.1);}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:40px;}
    .server-card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.15);border-radius:14px;padding:24px 16px;text-align:center;transition:all .2s;}
    .server-card:hover{border-color:rgba(124,58,237,0.4);transform:translateY(-2px);}
    .server-card.dim{opacity:0.55;}
    .server-icon{width:56px;height:56px;border-radius:14px;background:#1a1430;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;margin:0 auto 12px;overflow:hidden;}
    .server-name{font-size:13px;font-weight:500;margin-bottom:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .btn-primary{display:block;background:#7c3aed;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;transition:all .2s;}
    .btn-primary:hover{background:#6d28d9;}
    .btn-add{display:block;background:rgba(124,58,237,0.08);color:#a78bfa;padding:8px 12px;border-radius:8px;text-decoration:none;font-size:12px;border:1px solid rgba(124,58,237,0.2);transition:all .2s;}
    .btn-add:hover{background:rgba(124,58,237,0.15);}
    </style></head>
    <body>
    <div class="topbar">
      <div class="logo"><div class="logo-icon">O</div> Orbis</div>
      <div class="user">
        <img src="${avatarUrl}" onerror="this.style.display='none'">
        <span>${req.session.user.username}</span>
        <a href="/auth/logout" class="logout">Déconnexion</a>
      </div>
    </div>
    <div class="content">
      <div class="hero"><h2>Tes serveurs</h2><p class="sub">Sélectionne un serveur pour accéder au dashboard de gestion.</p></div>
      <div class="section-label">✅ Bot présent — ${mutual.length} serveur${mutual.length > 1 ? 's' : ''}</div>
      <div class="grid">${mutual.map(g => card(g, true)).join('')}</div>
      ${notIn.length ? `<div class="section-label">➕ Ajouter le bot — ${notIn.length} serveur${notIn.length > 1 ? 's' : ''}</div><div class="grid">${notIn.map(g => card(g, false)).join('')}</div>` : ''}
    </div></body></html>`);
  });

  // ─── Dashboard SPA ───────────────────────────────────────
  app.get("/dashboard/:guildId", requireAuth, (req, res) => {
    const { guildId } = req.params;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.redirect("/servers");
    const userGuild = req.session.user.guilds.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20) return res.redirect("/servers");
    res.sendFile(path.join(__dirname, "public/index.html"));
  });

  // ═══════════════════════════════════════════════════════
  //  API ROUTES
  // ═══════════════════════════════════════════════════════

  // ── Guild info ──
  router.get("/api/guild/:guildId", requireAuth, requireGuildAccess, async (req, res) => {
    const { guild } = req;
    await guild.fetch();
    await guild.members.fetch();
    const settings = getGuildSettings(guild.id);
    res.json({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 256 }),
      memberCount: guild.memberCount,
      onlineCount: guild.members.cache.filter(m => m.presence?.status !== "offline" && m.presence?.status).size,
      botCount: guild.members.cache.filter(m => m.user.bot).size,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
      settings,
    });
  });

  // ── Settings CRUD ──
  router.get("/api/guild/:guildId/settings", requireAuth, requireGuildAccess, (req, res) => {
    res.json(getGuildSettings(req.guild.id));
  });

  router.patch("/api/guild/:guildId/settings", requireAuth, requireGuildAccess, (req, res) => {
    const allowed = [
      "prefix","welcome_channel","welcome_message","leave_channel","leave_message",
      "log_channel","auto_role","levels_enabled","levels_channel","levels_message",
      "economy_enabled","suggestion_channel","report_channel","birthday_channel",
      "ticket_category","ticket_support_role","automod_enabled","automod_anti_spam",
      "automod_anti_link","automod_badwords","starboard_channel","starboard_threshold"
    ];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.json({ success: false, error: "Aucun champ valide" });
    const set = updates.map(k => `${k} = ?`).join(", ");
    const vals = updates.map(k => req.body[k]);
    db.prepare(`UPDATE guild_settings SET ${set} WHERE guild_id = ?`).run(...vals, req.guild.id);
    res.json({ success: true, settings: getGuildSettings(req.guild.id) });
  });

  // ── Members ──
  router.get("/api/guild/:guildId/members", requireAuth, requireGuildAccess, async (req, res) => {
    const { guild } = req;
    await guild.members.fetch();
    res.json(guild.members.cache.map(m => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName,
      avatar: m.user.displayAvatarURL({ size: 64 }),
      bot: m.user.bot,
      roles: m.roles.cache.filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
      joinedAt: m.joinedAt,
      status: m.presence?.status || "offline",
      level: (() => { const l = db.prepare("SELECT level, xp FROM member_levels WHERE guild_id=? AND user_id=?").get(guild.id, m.id); return l || { level: 0, xp: 0 }; })(),
      economy: (() => { const e = db.prepare("SELECT balance, bank FROM member_economy WHERE guild_id=? AND user_id=?").get(guild.id, m.id); return e || { balance: 0, bank: 0 }; })(),
    })));
  });

  router.post("/api/guild/:guildId/members/:userId/kick", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const member = await req.guild.members.fetch(req.params.userId);
      await member.kick(req.body.reason || "Aucune raison");
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:guildId/members/:userId/ban", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      await req.guild.members.ban(req.params.userId, { reason: req.body.reason || "Aucune raison", deleteMessageSeconds: 86400 });
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:guildId/members/:userId/timeout", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const member = await req.guild.members.fetch(req.params.userId);
      const duration = parseInt(req.body.duration) || 600000;
      await member.timeout(duration, req.body.reason || "Aucune raison");
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:guildId/members/:userId/roles/add", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const member = await req.guild.members.fetch(req.params.userId);
      await member.roles.add(req.body.roleId);
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:guildId/members/:userId/roles/remove", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const member = await req.guild.members.fetch(req.params.userId);
      await member.roles.remove(req.body.roleId);
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ── Roles ──
  router.get("/api/guild/:guildId/roles", requireAuth, requireGuildAccess, (req, res) => {
    res.json(req.guild.roles.cache
      .filter(r => r.id !== req.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor, memberCount: r.members.size, position: r.position, mentionable: r.mentionable, hoist: r.hoist })));
  });

  router.post("/api/guild/:guildId/roles", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const role = await req.guild.roles.create({ name: req.body.name || "Nouveau rôle", color: req.body.color || "#99aab5", reason: "Créé via le dashboard" });
      res.json({ success: true, role: { id: role.id, name: role.name, color: role.hexColor } });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.delete("/api/guild/:guildId/roles/:roleId", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const role = req.guild.roles.cache.get(req.params.roleId);
      if (!role) return res.status(404).json({ error: "Rôle introuvable" });
      await role.delete("Supprimé via le dashboard");
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ── Channels ──
  router.get("/api/guild/:guildId/channels", requireAuth, requireGuildAccess, (req, res) => {
    res.json(req.guild.channels.cache.map(c => ({
      id: c.id, name: c.name, type: c.type, parentId: c.parentId,
      parentName: c.parent?.name || null, position: c.rawPosition
    })).sort((a, b) => a.position - b.position));
  });

  // ── Warnings ──
  router.get("/api/guild/:guildId/warnings", requireAuth, requireGuildAccess, (req, res) => {
    const warns = db.prepare("SELECT * FROM warnings WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50").all(req.guild.id);
    res.json(warns);
  });

  router.post("/api/guild/:guildId/warnings", requireAuth, requireGuildAccess, (req, res) => {
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requis" });
    db.prepare("INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)").run(req.guild.id, userId, req.session.user.id, reason || "Aucune raison");
    res.json({ success: true });
  });

  router.delete("/api/guild/:guildId/warnings/:id", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM warnings WHERE id = ? AND guild_id = ?").run(req.params.id, req.guild.id);
    res.json({ success: true });
  });

  // ── Sanctions ──
  router.get("/api/guild/:guildId/sanctions", requireAuth, requireGuildAccess, (req, res) => {
    const sanctions = db.prepare("SELECT * FROM sanctions WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50").all(req.guild.id);
    res.json(sanctions);
  });

  // ── Tickets ──
  router.get("/api/guild/:guildId/tickets", requireAuth, requireGuildAccess, (req, res) => {
    const tickets = db.prepare("SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50").all(req.guild.id);
    res.json(tickets);
  });

  router.patch("/api/guild/:guildId/tickets/:id/close", requireAuth, requireGuildAccess, async (req, res) => {
    const ticket = db.prepare("SELECT * FROM tickets WHERE id = ? AND guild_id = ?").get(req.params.id, req.guild.id);
    if (!ticket) return res.status(404).json({ error: "Ticket introuvable" });
    db.prepare("UPDATE tickets SET status = 'closed' WHERE id = ?").run(ticket.id);
    try {
      const ch = req.guild.channels.cache.get(ticket.channel_id);
      if (ch) await ch.delete("Ticket fermé via le dashboard");
    } catch (_) {}
    res.json({ success: true });
  });

  // ── Levels leaderboard ──
  router.get("/api/guild/:guildId/levels", requireAuth, requireGuildAccess, (req, res) => {
    const rows = db.prepare("SELECT * FROM member_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 20").all(req.guild.id);
    res.json(rows);
  });

  // ── Economy leaderboard ──
  router.get("/api/guild/:guildId/economy", requireAuth, requireGuildAccess, (req, res) => {
    const rows = db.prepare("SELECT * FROM member_economy WHERE guild_id = ? ORDER BY (balance+bank) DESC LIMIT 20").all(req.guild.id);
    res.json(rows);
  });

  // ── Autoroles ──
  router.get("/api/guild/:guildId/autoroles", requireAuth, requireGuildAccess, (req, res) => {
    const rows = db.prepare("SELECT * FROM autoroles WHERE guild_id = ?").all(req.guild.id);
    res.json(rows);
  });

  router.post("/api/guild/:guildId/autoroles", requireAuth, requireGuildAccess, (req, res) => {
    const { roleId, type } = req.body;
    if (!roleId) return res.status(400).json({ error: "roleId requis" });
    db.prepare("INSERT OR IGNORE INTO autoroles (guild_id, role_id, type) VALUES (?, ?, ?)").run(req.guild.id, roleId, type || "all");
    res.json({ success: true });
  });

  router.delete("/api/guild/:guildId/autoroles/:roleId", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM autoroles WHERE guild_id = ? AND role_id = ?").run(req.guild.id, req.params.roleId);
    res.json({ success: true });
  });

  // ── Reaction Roles ──
  router.get("/api/guild/:guildId/reactionroles", requireAuth, requireGuildAccess, (req, res) => {
    const messages = db.prepare("SELECT * FROM reactionroles WHERE guild_id = ?").all(req.guild.id);
    const result = messages.map(m => ({
      ...m,
      items: db.prepare("SELECT * FROM reactionrole_items WHERE message_id = ?").all(m.message_id)
    }));
    res.json(result);
  });

  // ── Custom commands ──
  router.get("/api/guild/:guildId/commands", requireAuth, requireGuildAccess, (req, res) => {
    const cmds = db.prepare("SELECT * FROM custom_commands WHERE guild_id = ?").all(req.guild.id);
    res.json(cmds);
  });

  router.post("/api/guild/:guildId/commands", requireAuth, requireGuildAccess, (req, res) => {
    const { name, response } = req.body;
    if (!name || !response) return res.status(400).json({ error: "name et response requis" });
    try {
      db.prepare("INSERT INTO custom_commands (guild_id, name, response, created_by) VALUES (?, ?, ?, ?)").run(req.guild.id, name.toLowerCase(), response, req.session.user.id);
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Commande déjà existante" }); }
  });

  router.delete("/api/guild/:guildId/commands/:id", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM custom_commands WHERE id = ? AND guild_id = ?").run(req.params.id, req.guild.id);
    res.json({ success: true });
  });

  // ── Send message to channel ──
  router.post("/api/guild/:guildId/channels/:channelId/send", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const ch = req.guild.channels.cache.get(req.params.channelId);
      if (!ch || !ch.isTextBased()) return res.status(400).json({ error: "Salon invalide" });
      const msg = req.body.embed
        ? await ch.send({ embeds: [{ title: req.body.title, description: req.body.content, color: 0x7c3aed }] })
        : await ch.send(req.body.content);
      res.json({ success: true, messageId: msg.id });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ── Shop ──
  router.get("/api/guild/:guildId/shop", requireAuth, requireGuildAccess, (req, res) => {
    res.json(db.prepare("SELECT * FROM shop_items WHERE guild_id = ?").all(req.guild.id));
  });

  router.post("/api/guild/:guildId/shop", requireAuth, requireGuildAccess, (req, res) => {
    const { name, description, price, roleId, emoji } = req.body;
    if (!name || !price) return res.status(400).json({ error: "name et price requis" });
    const r = db.prepare("INSERT INTO shop_items (guild_id, name, description, price, role_id, emoji) VALUES (?,?,?,?,?,?)").run(req.guild.id, name, description || "", price, roleId || null, emoji || "🛍️");
    res.json({ success: true, id: r.lastInsertRowid });
  });

  router.delete("/api/guild/:guildId/shop/:id", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM shop_items WHERE id = ? AND guild_id = ?").run(req.params.id, req.guild.id);
    res.json({ success: true });
  });

  // ── Bans list ──
  router.get("/api/guild/:guildId/bans", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const bans = await req.guild.bans.fetch();
      res.json(bans.map(b => ({ userId: b.user.id, username: b.user.username, avatar: b.user.displayAvatarURL({ size: 64 }), reason: b.reason })));
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:guildId/bans/:userId/unban", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      await req.guild.members.unban(req.params.userId, req.body.reason || "Débanni via le dashboard");
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  // ── Suggestions ──
  router.get("/api/guild/:guildId/suggestions", requireAuth, requireGuildAccess, (req, res) => {
    res.json(db.prepare("SELECT * FROM suggestions WHERE guild_id = ? ORDER BY created_at DESC LIMIT 30").all(req.guild.id));
  });

  app.use(router);
  return router;
};
