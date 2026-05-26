const requireGuildAccess = (req, res, next) => next();
const requireAuth = (req, res, next) => next();
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const router = express.Router();



// ── API SAUVEGARDE CONFIGURATION TICKET ──
router.post("/api/guild/:guildId/ticket-settings", requireAuth, requireGuildAccess, (req, res) => {
  const gid = req.guild.id, s = req.body, fields = [], values = [];
  const allowed = ["two_step_close", "two_step_ticket", "auto_pin_ticket", "ticket_padding", "category_open_id", "category_closed_id", "ticket_open_name", "ticket_close_name", "ticket_open_message", "ticket_close_question", "ticket_support_role"];
  allowed.forEach(k => { if(s[k] !== undefined) { fields.push(k + " = ?"); values.push(s[k]); } });
  if(fields.length === 0) return res.status(400).json({ error: "Aucune donnée valide" });
  values.push(gid);
  if(!db.prepare("SELECT guild_id FROM guild_settings WHERE guild_id = ?").get(gid)) db.prepare("INSERT INTO guild_settings (guild_id) VALUES (?)").run(gid);
  db.prepare("UPDATE guild_settings SET " + fields.join(", ") + " WHERE guild_id = ?").run(...values);
  res.json({ success: true, message: "Configuration mise à jour !" });
});
module.exports = (client, app) => {


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
    <body><div class="card"><div class="logo" style="background:none;padding:0;overflow:hidden;"><img src="https://i.ibb.co/xtkD3j28/image-2026-05-24-201343936.png" style="width:100%;height:100%;object-fit:cover;border-radius:16px;"></div><h1>Orbis Dashboard</h1><p>Connecte-toi avec Discord pour gérer ton serveur</p>
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
      req.session.user = { ...userRes.data, guilds: guildsRes.data, token }; req.session.save((err) => {
      res.redirect("/servers"); });
    } catch (e) {
      console.error("[OAuth]", e.message);
      res.redirect("/login?error=1");
    }
  });

app.get("/auth/me", (req, res) => { if (!req.session.user) return res.json({}); res.json(req.session.user); });
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
      <div class="logo"><div class="logo-icon" style="background:none;padding:0;overflow:hidden;"><img src="https://i.ibb.co/xtkD3j28/image-2026-05-24-201343936.png" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div> Orbis Dashboard</div>
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


  router.get("/api/guild/:id/settings", requireAuth, async (req, res) => {
    const { db, getGuildSettings } = require("../database/db.js");
    res.json(getGuildSettings(req.params.id));
  });
  router.patch("/api/guild/:id/settings", requireAuth, async (req, res) => {
    const { db, getGuildSettings } = require("../database/db.js");
    const allowed = ["prefix","welcome_channel","welcome_message","leave_channel","leave_message","log_channel","auto_role","levels_enabled","levels_channel","levels_message","economy_enabled","suggestion_channel","report_channel","automod_enabled","automod_anti_spam","automod_anti_link","automod_badwords","ticket_category","ticket_support_role"];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.json({ success: false });
    const set = updates.map(k => k + " = ?").join(", ");
    db.prepare("UPDATE guild_settings SET " + set + " WHERE guild_id = ?").run(...updates.map(k => req.body[k]), req.params.id);
    res.json({ success: true, settings: getGuildSettings(req.params.id) });
  });
  router.get("/api/guild/:id/levels", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    res.json(db.prepare("SELECT * FROM member_levels WHERE guild_id=? ORDER BY xp DESC LIMIT 20").all(req.params.id));
  });
  router.get("/api/guild/:id/economy", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    res.json(db.prepare("SELECT * FROM member_economy WHERE guild_id=? ORDER BY (balance+bank) DESC LIMIT 20").all(req.params.id));
  });
  router.get("/api/guild/:id/tickets", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM tickets WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.patch("/api/guild/:id/tickets/:tid/close", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const guild = client.guilds.cache.get(req.params.id);
    const t = db.prepare("SELECT * FROM tickets WHERE id=? AND guild_id=?").get(req.params.tid, req.params.id);
    if (!t) return res.status(404).json({ error: "Introuvable" });
    db.prepare("UPDATE tickets SET status='closed' WHERE id=?").run(t.id);
    try { const ch = guild.channels.cache.get(t.channel_id); if (ch) await ch.delete(); } catch(_) {}
    res.json({ success: true });
  });
  router.get("/api/guild/:id/warnings", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM warnings WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/warnings", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { userId, reason } = req.body;
    db.prepare("INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?,?,?,?)").run(req.params.id, userId, req.session.user.id, reason||"Dashboard");
    res.json({ success: true });
  });
  router.delete("/api/guild/:id/warnings/:wid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM warnings WHERE id=? AND guild_id=?").run(req.params.wid, req.params.id);
    res.json({ success: true });
  });
  router.get("/api/guild/:id/sanctions", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM sanctions WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.get("/api/guild/:id/bans", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json([]);
    try { const bans = await guild.bans.fetch(); res.json(bans.map(b => ({ userId:b.user.id, username:b.user.username, avatar:b.user.displayAvatarURL({size:64}), reason:b.reason }))); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/bans/:uid/unban", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { await guild.members.unban(req.params.uid); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.get("/api/guild/:id/autoroles", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM autoroles WHERE guild_id=?").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/autoroles", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { roleId, type } = req.body;
    db.prepare("INSERT OR IGNORE INTO autoroles (guild_id, role_id, type) VALUES (?,?,?)").run(req.params.id, roleId, type||"all");
    res.json({ success: true });
  });
  router.delete("/api/guild/:id/autoroles/:rid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM autoroles WHERE guild_id=? AND role_id=?").run(req.params.id, req.params.rid);
    res.json({ success: true });
  });
  router.get("/api/guild/:id/commands", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM custom_commands WHERE guild_id=?").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/commands", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { name, response } = req.body;
    try { db.prepare("INSERT INTO custom_commands (guild_id, name, response, created_by) VALUES (?,?,?,?)").run(req.params.id, name.toLowerCase(), response, req.session.user.id); res.json({ success: true }); } catch(e) { res.status(400).json({ error: "Commande existante" }); }
  });
  router.delete("/api/guild/:id/commands/:cid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM custom_commands WHERE id=? AND guild_id=?").run(req.params.cid, req.params.id);
    res.json({ success: true });
  });
  router.get("/api/guild/:id/shop", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM shop_items WHERE guild_id=?").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/shop", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { name, description, price, roleId, emoji } = req.body;
    const r = db.prepare("INSERT INTO shop_items (guild_id, name, description, price, role_id, emoji) VALUES (?,?,?,?,?,?)").run(req.params.id, name, description||"", price, roleId||null, emoji||"🛍️");
    res.json({ success: true, id: r.lastInsertRowid });
  });
  router.delete("/api/guild/:id/shop/:sid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM shop_items WHERE id=? AND guild_id=?").run(req.params.sid, req.params.id);
    res.json({ success: true });
  });
  router.post("/api/guild/:id/members/:uid/kick", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.kick(req.body.reason||"Dashboard"); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/ban", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { await guild.members.ban(req.params.uid, { reason: req.body.reason||"Dashboard" }); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/timeout", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.timeout(parseInt(req.body.duration)||600000, req.body.reason||"Dashboard"); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/roles/add", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.roles.add(req.body.roleId); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/roles/remove", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.roles.remove(req.body.roleId); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/channels/:cid/send", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const ch = guild.channels.cache.get(req.params.cid); if (!ch||!ch.isTextBased()) return res.status(400).json({ error:"Salon invalide" }); const msg = req.body.embed ? await ch.send({ embeds:[{ title:req.body.title, description:req.body.content, color:0x7c3aed }] }) : await ch.send(req.body.content); res.json({ success: true, messageId: msg.id }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/roles", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const r = await guild.roles.create({ name:req.body.name||"Nouveau rôle", color:req.body.color||"#99aab5" }); res.json({ success: true, role: { id:r.id, name:r.name, color:r.hexColor } }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.delete("/api/guild/:id/roles/:rid", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const r = guild.roles.cache.get(req.params.rid); if (!r) return res.status(404).json({ error:"Rôle introuvable" }); await r.delete(); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  app.use(router);


  router.get("/api/guild/:id/settings", requireAuth, async (req, res) => {
    const { db, getGuildSettings } = require("../database/db.js");
    res.json(getGuildSettings(req.params.id));
  });
  router.patch("/api/guild/:id/settings", requireAuth, async (req, res) => {
    const { db, getGuildSettings } = require("../database/db.js");
    const allowed = ["prefix","welcome_channel","welcome_message","leave_channel","leave_message","log_channel","auto_role","levels_enabled","levels_channel","levels_message","economy_enabled","suggestion_channel","report_channel","automod_enabled","automod_anti_spam","automod_anti_link","automod_badwords","ticket_category","ticket_support_role"];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.json({ success: false });
    const set = updates.map(k => k + " = ?").join(", ");
    db.prepare("UPDATE guild_settings SET " + set + " WHERE guild_id = ?").run(...updates.map(k => req.body[k]), req.params.id);
    res.json({ success: true, settings: getGuildSettings(req.params.id) });
  });
  router.get("/api/guild/:id/levels", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    res.json(db.prepare("SELECT * FROM member_levels WHERE guild_id=? ORDER BY xp DESC LIMIT 20").all(req.params.id));
  });
  router.get("/api/guild/:id/economy", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    res.json(db.prepare("SELECT * FROM member_economy WHERE guild_id=? ORDER BY (balance+bank) DESC LIMIT 20").all(req.params.id));
  });
  router.get("/api/guild/:id/tickets", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM tickets WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.patch("/api/guild/:id/tickets/:tid/close", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const guild = client.guilds.cache.get(req.params.id);
    const t = db.prepare("SELECT * FROM tickets WHERE id=? AND guild_id=?").get(req.params.tid, req.params.id);
    if (!t) return res.status(404).json({ error: "Introuvable" });
    db.prepare("UPDATE tickets SET status='closed' WHERE id=?").run(t.id);
    try { const ch = guild.channels.cache.get(t.channel_id); if (ch) await ch.delete(); } catch(_) {}
    res.json({ success: true });
  });
  router.get("/api/guild/:id/warnings", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM warnings WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/warnings", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { userId, reason } = req.body;
    db.prepare("INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?,?,?,?)").run(req.params.id, userId, req.session.user.id, reason||"Dashboard");
    res.json({ success: true });
  });
  router.delete("/api/guild/:id/warnings/:wid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM warnings WHERE id=? AND guild_id=?").run(req.params.wid, req.params.id);
    res.json({ success: true });
  });
  router.get("/api/guild/:id/sanctions", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM sanctions WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.get("/api/guild/:id/bans", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) return res.json([]);
    try { const bans = await guild.bans.fetch(); res.json(bans.map(b => ({ userId:b.user.id, username:b.user.username, avatar:b.user.displayAvatarURL({size:64}), reason:b.reason }))); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/bans/:uid/unban", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { await guild.members.unban(req.params.uid); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.get("/api/guild/:id/autoroles", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM autoroles WHERE guild_id=?").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/autoroles", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { roleId, type } = req.body;
    db.prepare("INSERT OR IGNORE INTO autoroles (guild_id, role_id, type) VALUES (?,?,?)").run(req.params.id, roleId, type||"all");
    res.json({ success: true });
  });
  router.delete("/api/guild/:id/autoroles/:rid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM autoroles WHERE guild_id=? AND role_id=?").run(req.params.id, req.params.rid);
    res.json({ success: true });
  });
  router.get("/api/guild/:id/commands", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM custom_commands WHERE guild_id=?").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/commands", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { name, response } = req.body;
    try { db.prepare("INSERT INTO custom_commands (guild_id, name, response, created_by) VALUES (?,?,?,?)").run(req.params.id, name.toLowerCase(), response, req.session.user.id); res.json({ success: true }); } catch(e) { res.status(400).json({ error: "Commande existante" }); }
  });
  router.delete("/api/guild/:id/commands/:cid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM custom_commands WHERE id=? AND guild_id=?").run(req.params.cid, req.params.id);
    res.json({ success: true });
  });
  router.get("/api/guild/:id/shop", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try { res.json(db.prepare("SELECT * FROM shop_items WHERE guild_id=?").all(req.params.id)); } catch(e) { res.json([]); }
  });
  router.post("/api/guild/:id/shop", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { name, description, price, roleId, emoji } = req.body;
    const r = db.prepare("INSERT INTO shop_items (guild_id, name, description, price, role_id, emoji) VALUES (?,?,?,?,?,?)").run(req.params.id, name, description||"", price, roleId||null, emoji||"🛍️");
    res.json({ success: true, id: r.lastInsertRowid });
  });
  router.delete("/api/guild/:id/shop/:sid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM shop_items WHERE id=? AND guild_id=?").run(req.params.sid, req.params.id);
    res.json({ success: true });
  });
  router.post("/api/guild/:id/members/:uid/kick", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.kick(req.body.reason||"Dashboard"); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/ban", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { await guild.members.ban(req.params.uid, { reason: req.body.reason||"Dashboard" }); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/timeout", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.timeout(parseInt(req.body.duration)||600000, req.body.reason||"Dashboard"); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/roles/add", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.roles.add(req.body.roleId); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/members/:uid/roles/remove", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const m = await guild.members.fetch(req.params.uid); await m.roles.remove(req.body.roleId); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/channels/:cid/send", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const ch = guild.channels.cache.get(req.params.cid); if (!ch||!ch.isTextBased()) return res.status(400).json({ error:"Salon invalide" }); const msg = req.body.embed ? await ch.send({ embeds:[{ title:req.body.title, description:req.body.content, color:0x7c3aed }] }) : await ch.send(req.body.content); res.json({ success: true, messageId: msg.id }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/roles", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const r = await guild.roles.create({ name:req.body.name||"Nouveau rôle", color:req.body.color||"#99aab5" }); res.json({ success: true, role: { id:r.id, name:r.name, color:r.hexColor } }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.delete("/api/guild/:id/roles/:rid", requireAuth, async (req, res) => {
    const guild = client.guilds.cache.get(req.params.id);
    try { const r = guild.roles.cache.get(req.params.rid); if (!r) return res.status(404).json({ error:"Rôle introuvable" }); await r.delete(); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  app.use(router);


  // ── Ticket Panels ──
  router.get("/api/guild/:id/ticket-panels", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try {
      const panels = db.prepare("SELECT * FROM ticket_panels WHERE guild_id=? ORDER BY created_at DESC").all(req.params.id);
      res.json(panels.map(p => ({ ...p, categories: db.prepare("SELECT * FROM ticket_categories WHERE panel_id=? ORDER BY position ASC").all(p.id) })));
    } catch(e) { res.json([]); }
  });
  router.get("/api/guild/:id/ticket-panels/:pid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    try {
      const panel = db.prepare("SELECT * FROM ticket_panels WHERE id=? AND guild_id=?").get(req.params.pid, req.params.id);
      if (!panel) return res.status(404).json({ error: "Panel introuvable" });
      panel.categories = db.prepare("SELECT * FROM ticket_categories WHERE panel_id=? ORDER BY position ASC").all(panel.id);
      res.json(panel);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/ticket-panels", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { name, embed_title, embed_description, embed_color, button_label, button_style, welcome_message } = req.body;
    const r = db.prepare("INSERT INTO ticket_panels (guild_id,name,embed_title,embed_description,embed_color,button_label,button_style,welcome_message) VALUES (?,?,?,?,?,?,?,?)").run(req.params.id, name||"Support", embed_title||"\uD83C\uDFAB Ouvrir un ticket", embed_description||"Clique sur le bouton pour ouvrir un ticket.", embed_color||"#7c3aed", button_label||"\uD83D\uDCE9 Ouvrir un ticket", button_style||"PRIMARY", welcome_message||"Bonjour {user} !");
    res.json({ success: true, id: r.lastInsertRowid });
  });
  router.patch("/api/guild/:id/ticket-panels/:pid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const allowed = ["name","embed_title","embed_description","embed_color","button_label","button_style","welcome_message","support_role_id","default_category_id","channel_id"];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.json({ success: false });
    const set = updates.map(k => k + " = ?").join(", ");
    db.prepare("UPDATE ticket_panels SET " + set + " WHERE id=? AND guild_id=?").run(...updates.map(k => req.body[k]), req.params.pid, req.params.id);
    res.json({ success: true });
  });
  router.delete("/api/guild/:id/ticket-panels/:pid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM ticket_categories WHERE panel_id=?").run(req.params.pid);
    db.prepare("DELETE FROM ticket_panels WHERE id=? AND guild_id=?").run(req.params.pid, req.params.id);
    res.json({ success: true });
  });
  router.post("/api/guild/:id/ticket-panels/:pid/send", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
    const guild = client.guilds.cache.get(req.params.id);
    const panel = db.prepare("SELECT * FROM ticket_panels WHERE id=? AND guild_id=?").get(req.params.pid, req.params.id);
    if (!panel) return res.status(404).json({ error: "Panel introuvable" });
    const channelId = req.body.channel_id || panel.channel_id;
    if (!channelId) return res.status(400).json({ error: "Salon requis" });
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(400).json({ error: "Salon invalide" });
    const color = parseInt((panel.embed_color||"#7c3aed").replace("#",""), 16);
    const embed = new EmbedBuilder().setColor(color).setTitle(panel.embed_title||"Ouvrir un ticket").setDescription(panel.embed_description||"Clique sur le bouton.");
    const btnStyle = { PRIMARY: ButtonStyle.Primary, SECONDARY: ButtonStyle.Secondary, SUCCESS: ButtonStyle.Success, DANGER: ButtonStyle.Danger }[panel.button_style] || ButtonStyle.Primary;
    const btn = new ButtonBuilder().setCustomId("ticket_open_panel_" + panel.id).setLabel(panel.button_label||"Ouvrir un ticket").setStyle(btnStyle);
    const row = new ActionRowBuilder().addComponents(btn);
    try {
      const msg = await channel.send({ embeds: [embed], components: [row] });
      db.prepare("UPDATE ticket_panels SET message_id=?, channel_id=? WHERE id=?").run(msg.id, channelId, panel.id);
      res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.post("/api/guild/:id/ticket-panels/:pid/categories", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const { name, emoji, discord_category_id, support_role_id } = req.body;
    if (!name) return res.status(400).json({ error: "name requis" });
    const r = db.prepare("INSERT INTO ticket_categories (panel_id,guild_id,name,emoji,discord_category_id,support_role_id) VALUES (?,?,?,?,?,?)").run(req.params.pid, req.params.id, name, emoji||"\uD83C\uDFAB", discord_category_id||null, support_role_id||null);
    res.json({ success: true, id: r.lastInsertRowid });
  });
  router.patch("/api/guild/:id/ticket-categories/:cid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    const allowed = ["name","emoji","discord_category_id","support_role_id","position"];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.json({ success: false });
    const set = updates.map(k => k + " = ?").join(", ");
    db.prepare("UPDATE ticket_categories SET " + set + " WHERE id=? AND guild_id=?").run(...updates.map(k => req.body[k]), req.params.cid, req.params.id);
    res.json({ success: true });
  });
  router.delete("/api/guild/:id/ticket-categories/:cid", requireAuth, async (req, res) => {
    const { db } = require("../database/db.js");
    db.prepare("DELETE FROM ticket_categories WHERE id=? AND guild_id=?").run(req.params.cid, req.params.id);
    res.json({ success: true });
  });

  app.use(router);
  return router;
};
