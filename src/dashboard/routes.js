const express = require("express");
const session = require("express-session");
const axios = require("axios");
const path = require("path");
const router = express.Router();
const SqliteStore = require("better-sqlite3-session-store")(session);

module.exports = (client, app) => {
  const { db, getGuildSettings } = require("../database/db.js");

  app.use(express.static(path.join(__dirname, "public")));
  const sessionDb = require("better-sqlite3")("./sessions.db");
  app.use(session({
    secret: process.env.SESSION_SECRET || "secret",
    store: new SqliteStore({ client: sessionDb }),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24, sameSite: 'lax', httpOnly: true }
  }));

  function requireAuth(req, res, next) {
    if (req.session?.user) return next();
    res.redirect("/login");
  }

  function requireGuildAccess(req, res, next) {
    const guildId = req.params.id || req.params.guildId;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Serveur introuvable" });
    const userGuild = req.session.user?.guilds?.find(g => g.id === guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20)
      return res.status(403).json({ error: "Accès refusé" });
    req.guild = guild;
    next();
  }

  // ── Auth ──
  app.get("/login", (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orbis Login</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;}
    .card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:40px;text-align:center;width:340px;}
    h1{font-size:22px;margin-bottom:8px;}p{color:#7c6fa0;font-size:13px;margin-bottom:28px;}
    a{display:block;background:#5865f2;color:#fff;padding:12px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;}
    a:hover{background:#4752c4;}</style></head>
    <body><div class="card"><h1>Orbis Dashboard</h1><p>Connecte-toi avec Discord</p>
    <a href="/auth/discord">Se connecter avec Discord</a></div></body></html>`);
  });

  app.get("/auth/discord", (req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: (process.env.DASHBOARD_URL || "http://localhost:3001") + "/auth/callback",
      response_type: "code", scope: "identify guilds",
    });
    res.redirect("https://discord.com/oauth2/authorize?" + params.toString());
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/login");
    try {
      const tokenRes = await axios.post("https://discord.com/api/oauth2/token",
        new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: (process.env.DASHBOARD_URL || "http://localhost:3001") + "/auth/callback" }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      const token = tokenRes.data.access_token;
      const [userRes, guildsRes] = await Promise.all([
        axios.get("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token } }),
        axios.get("https://discord.com/api/users/@me/guilds", { headers: { Authorization: "Bearer " + token } }),
      ]);
      req.session.user = { ...userRes.data, guilds: guildsRes.data, token };
      req.session.save(() => res.redirect("/servers"));
    } catch (e) { console.error("[OAuth]", e.message); res.redirect("/login?error=1"); }
  });

  app.get("/auth/me", (req, res) => { if (!req.session.user) return res.json({}); res.json(req.session.user); });
  app.get("/auth/logout", (req, res) => { req.session.destroy(); res.redirect("/login"); });

  // ── Servers ──
  app.get("/servers", requireAuth, (req, res) => {
    const userGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x20) === 0x20);
    const botGuilds = client.guilds.cache;
    const mutual = userGuilds.filter(g => botGuilds.has(g.id));
    const notIn = userGuilds.filter(g => !botGuilds.has(g.id));
    const card = (g, hasBot) => {
      const icon = g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">` : g.name[0];
      return `<div class="server-card"><div class="server-icon">${icon}</div><div class="server-name">${g.name}</div>
        ${hasBot ? `<a href="/dashboard/${g.id}" class="btn-primary">Gérer →</a>` : `<a href="https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&scope=bot&permissions=8&guild_id=${g.id}" class="btn-add" target="_blank">+ Ajouter</a>`}
      </div>`;
    };
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Orbis — Serveurs</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:sans-serif;min-height:100vh;}
    .topbar{background:#0e0a1a;border-bottom:1px solid rgba(124,58,237,0.15);padding:16px 32px;display:flex;align-items:center;justify-content:space-between;}
    .logo{font-weight:700;font-size:18px;}.user{display:flex;align-items:center;gap:10px;font-size:13px;}
    .user img{width:28px;height:28px;border-radius:50%;}.logout{color:#7c6fa0;text-decoration:none;font-size:12px;border:1px solid rgba(124,58,237,0.2);padding:4px 10px;border-radius:6px;}
    .content{max-width:1000px;margin:0 auto;padding:40px 24px;}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:32px;}
    .server-card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.15);border-radius:12px;padding:20px;text-align:center;}
    .server-icon{width:56px;height:56px;border-radius:14px;background:#7c3aed;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;margin:0 auto 12px;overflow:hidden;}
    .server-name{font-size:13px;font-weight:500;margin-bottom:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .btn-primary{display:block;background:#7c3aed;color:#fff;padding:8px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;}
    .btn-add{display:block;background:rgba(124,58,237,0.1);color:#a78bfa;padding:8px;border-radius:6px;text-decoration:none;font-size:12px;border:1px solid rgba(124,58,237,0.2);}
    .label{font-size:12px;color:#4a4060;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;}</style></head>
    <body><div class="topbar"><div class="logo">Orbis Dashboard</div>
    <div class="user"><img src="https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png" onerror="this.style.display='none'">${req.session.user.username}<a href="/auth/logout" class="logout">Déconnexion</a></div></div>
    <div class="content"><h2 style="margin-bottom:24px">Tes serveurs</h2>
    <div class="label">✅ Bot présent (${mutual.length})</div><div class="grid">${mutual.map(g => card(g, true)).join('')}</div>
    ${notIn.length ? `<div class="label">➕ Ajouter (${notIn.length})</div><div class="grid">${notIn.map(g => card(g, false)).join('')}</div>` : ''}
    </div></body></html>`);
  });

  app.get("/dashboard/:guildId", requireAuth, (req, res) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) return res.redirect("/servers");
    const userGuild = req.session.user.guilds.find(g => g.id === req.params.guildId);
    if (!userGuild || (userGuild.permissions & 0x20) !== 0x20) return res.redirect("/servers");
    res.sendFile(path.join(__dirname, "public/index.html"));
  });

  // ══════════════════════════════════════
  //  API ROUTES
  // ══════════════════════════════════════

  router.get("/api/guild/:id/status", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ online: true, ping: client.ws.ping });
  });

  router.post("/api/guild/:id/permissions", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true });
  });

  router.get("/api/guild/:id", requireAuth, requireGuildAccess, async (req, res) => {
    const { guild } = req;
    await guild.fetch();
    res.json({ id: guild.id, name: guild.name, icon: guild.iconURL({ size: 256, extension: "png" }), memberCount: guild.memberCount, onlineCount: guild.members.cache.filter(m => ["online","idle","dnd"].includes(m.presence?.status)).size, channelCount: guild.channels.cache.size, roleCount: guild.roles.cache.size, settings: getGuildSettings(guild.id) });
  });

  router.get("/api/guilds", requireAuth, (req, res) => {
    const userGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x20) === 0x20);
    res.json(client.guilds.cache.filter(g => userGuilds.some(ug => ug.id === g.id)).map(g => g.id));
  });

  router.get("/api/guild/:id/members", requireAuth, requireGuildAccess, async (req, res) => {
    const { guild } = req;
    await guild.members.fetch();
    res.json(guild.members.cache.map(m => ({ id: m.id, username: m.user.username, displayName: m.displayName, avatar: m.user.displayAvatarURL({ size: 64 }), bot: m.user.bot, roles: m.roles.cache.filter(r => r.id !== guild.id).sort((a,b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.hexColor })), joinedAt: m.joinedAt, status: m.presence?.status || "offline" })));
  });

  router.get("/api/guild/:id/roles", requireAuth, requireGuildAccess, async (req, res) => {
    await req.guild.roles.fetch();
    res.json(req.guild.roles.cache.filter(r => r.id !== req.guild.id).sort((a,b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.hexColor, memberCount: r.members.size, position: r.position })));
  });

  router.post("/api/guild/:id/roles", requireAuth, requireGuildAccess, async (req, res) => {
    try { const r = await req.guild.roles.create({ name: req.body.name||"Nouveau rôle", color: req.body.color||"#99aab5" }); res.json({ success: true, role: { id: r.id, name: r.name, color: r.hexColor } }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.delete("/api/guild/:id/roles/:rid", requireAuth, requireGuildAccess, async (req, res) => {
    try { const r = req.guild.roles.cache.get(req.params.rid); if (!r) return res.status(404).json({ error: "Rôle introuvable" }); await r.delete(); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.get("/api/guild/:id/channels", requireAuth, requireGuildAccess, (req, res) => {
    res.json(req.guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId })));
  });

  router.get("/api/guild/:id/settings", requireAuth, requireGuildAccess, (req, res) => {
    res.json(getGuildSettings(req.guild.id));
  });

  router.patch("/api/guild/:id/settings", requireAuth, requireGuildAccess, (req, res) => {
    const allowed = ["prefix","welcome_channel","welcome_message","leave_channel","leave_message","log_channel","auto_role","levels_enabled","levels_channel","levels_message","economy_enabled","suggestion_channel","report_channel","automod_enabled","automod_anti_spam","automod_anti_link","automod_badwords","ticket_category","ticket_support_role","an_ban_thresh","an_kick_thresh","an_chan_thresh","an_action","an_alert_channel","an_punish_role","antinuke_enabled","an_massban","an_masskick","an_delchan","an_delrole","an_massmention","an_webhook","tempchan_enabled","tempchan_hub","tempchan_category","tempchan_name","tempchan_limit","tempchan_rename","tempchan_limit_perm","tempchan_lock","verification_enabled","verification_channel","verification_role","verification_method","verification_message","verification_question","verification_answer","ai_enabled","ai_channel","ai_model","ai_prompt","ai_language","ai_memory","ai_max_tokens","ai_persona","ai_lang","music_dj_only","music_dj_role","music_voice_channel","music_text_channel"];
    const updates = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!updates.length) return res.json({ success: false });
    db.prepare("UPDATE guild_settings SET " + updates.map(k => k+" = ?").join(", ") + " WHERE guild_id = ?").run(...updates.map(k => req.body[k]), req.guild.id);
    res.json({ success: true, settings: getGuildSettings(req.guild.id) });
  });

  router.post("/api/guild/:id/ticket-settings", requireAuth, requireGuildAccess, (req, res) => {
    const s = req.body, fields = [], values = [];
    const allowed = ["two_step_close","two_step_ticket","auto_pin_ticket","ticket_padding","category_open_id","category_closed_id","ticket_open_name","ticket_close_name","ticket_open_message","ticket_close_question","ticket_support_role"];
    allowed.forEach(k => { if(s[k] !== undefined) { fields.push(k+" = ?"); values.push(s[k]); } });
    if (!fields.length) return res.status(400).json({ error: "Aucune donnée valide" });
    values.push(req.guild.id);
    db.prepare("UPDATE guild_settings SET " + fields.join(", ") + " WHERE guild_id = ?").run(...values);
    res.json({ success: true });
  });

  router.get("/api/guild/:id/warnings", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM warnings WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.post("/api/guild/:id/warnings", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?,?,?,?)").run(req.guild.id, req.body.userId, req.session.user.id, req.body.reason||"Dashboard");
    res.json({ success: true });
  });

  router.delete("/api/guild/:id/warnings/:wid", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM warnings WHERE id=? AND guild_id=?").run(req.params.wid, req.guild.id);
    res.json({ success: true });
  });

  router.get("/api/guild/:id/sanctions", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM sanctions WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/tickets", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM tickets WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.patch("/api/guild/:id/tickets/:tid/close", requireAuth, requireGuildAccess, async (req, res) => {
    const t = db.prepare("SELECT * FROM tickets WHERE id=? AND guild_id=?").get(req.params.tid, req.guild.id);
    if (!t) return res.status(404).json({ error: "Introuvable" });
    db.prepare("UPDATE tickets SET status='closed' WHERE id=?").run(t.id);
    try { const ch = req.guild.channels.cache.get(t.channel_id); if (ch) await ch.delete(); } catch(_) {}
    res.json({ success: true });
  });

  router.get("/api/guild/:id/levels", requireAuth, requireGuildAccess, (req, res) => {
    res.json(db.prepare("SELECT * FROM member_levels WHERE guild_id=? ORDER BY xp DESC LIMIT 20").all(req.guild.id));
  });

  router.get("/api/guild/:id/economy", requireAuth, requireGuildAccess, (req, res) => {
    res.json(db.prepare("SELECT * FROM member_economy WHERE guild_id=? ORDER BY (balance+bank) DESC LIMIT 20").all(req.guild.id));
  });

  router.get("/api/guild/:id/bans", requireAuth, requireGuildAccess, async (req, res) => {
    try { const bans = await req.guild.bans.fetch(); res.json(bans.map(b => ({ userId: b.user.id, username: b.user.username, avatar: b.user.displayAvatarURL({ size: 64 }), reason: b.reason }))); } catch(e) { res.json([]); }
  });

  router.post("/api/guild/:id/bans/:uid/unban", requireAuth, requireGuildAccess, async (req, res) => {
    try { await req.guild.members.unban(req.params.uid); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.get("/api/guild/:id/autoroles", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM autoroles WHERE guild_id=?").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.post("/api/guild/:id/autoroles", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("INSERT OR IGNORE INTO autoroles (guild_id, role_id, type) VALUES (?,?,?)").run(req.guild.id, req.body.roleId, req.body.type||"all");
    res.json({ success: true });
  });

  router.delete("/api/guild/:id/autoroles/:rid", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM autoroles WHERE guild_id=? AND role_id=?").run(req.guild.id, req.params.rid);
    res.json({ success: true });
  });

  router.get("/api/guild/:id/reactionroles", requireAuth, requireGuildAccess, (req, res) => {
    try {
      const messages = db.prepare("SELECT * FROM reactionroles WHERE guild_id=?").all(req.guild.id);
      res.json(messages.map(m => ({ ...m, items: db.prepare("SELECT * FROM reactionrole_items WHERE message_id=?").all(m.message_id) })));
    } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/commands", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM custom_commands WHERE guild_id=?").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.post("/api/guild/:id/commands", requireAuth, requireGuildAccess, (req, res) => {
    try { db.prepare("INSERT INTO custom_commands (guild_id, name, response, created_by) VALUES (?,?,?,?)").run(req.guild.id, req.body.name.toLowerCase(), req.body.response, req.session.user.id); res.json({ success: true }); } catch(e) { res.status(400).json({ error: "Commande existante" }); }
  });

  router.delete("/api/guild/:id/commands/:cid", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM custom_commands WHERE id=? AND guild_id=?").run(req.params.cid, req.guild.id);
    res.json({ success: true });
  });

  router.get("/api/guild/:id/shop", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM shop_items WHERE guild_id=?").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.post("/api/guild/:id/shop", requireAuth, requireGuildAccess, (req, res) => {
    const { name, description, price, roleId, emoji } = req.body;
    const r = db.prepare("INSERT INTO shop_items (guild_id, name, description, price, role_id, emoji) VALUES (?,?,?,?,?,?)").run(req.guild.id, name, description||"", price, roleId||null, emoji||"🛍️");
    res.json({ success: true, id: r.lastInsertRowid });
  });

  router.delete("/api/guild/:id/shop/:sid", requireAuth, requireGuildAccess, (req, res) => {
    db.prepare("DELETE FROM shop_items WHERE id=? AND guild_id=?").run(req.params.sid, req.guild.id);
    res.json({ success: true });
  });

  router.post("/api/guild/:id/members/:uid/kick", requireAuth, requireGuildAccess, async (req, res) => {
    try { const m = await req.guild.members.fetch(req.params.uid); await m.kick(req.body.reason||"Dashboard"); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:id/members/:uid/ban", requireAuth, requireGuildAccess, async (req, res) => {
    try { await req.guild.members.ban(req.params.uid, { reason: req.body.reason||"Dashboard" }); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:id/members/:uid/timeout", requireAuth, requireGuildAccess, async (req, res) => {
    try { const m = await req.guild.members.fetch(req.params.uid); await m.timeout(parseInt(req.body.duration)||600000, req.body.reason||"Dashboard"); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:id/members/:uid/roles/add", requireAuth, requireGuildAccess, async (req, res) => {
    try { const m = await req.guild.members.fetch(req.params.uid); await m.roles.add(req.body.roleId); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:id/members/:uid/roles/remove", requireAuth, requireGuildAccess, async (req, res) => {
    try { const m = await req.guild.members.fetch(req.params.uid); await m.roles.remove(req.body.roleId); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post("/api/guild/:id/channels/:cid/send", requireAuth, requireGuildAccess, async (req, res) => {
    try { const ch = req.guild.channels.cache.get(req.params.cid); if (!ch||!ch.isTextBased()) return res.status(400).json({ error:"Salon invalide" }); const msg = req.body.embed ? await ch.send({ embeds:[{ title:req.body.title, description:req.body.content, color:0x7c3aed }] }) : await ch.send(req.body.content); res.json({ success: true, messageId: msg.id }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.get("/api/guild/:id/suggestions", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM suggestions WHERE guild_id=? ORDER BY created_at DESC LIMIT 30").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/antinuke/alerts", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM antinuke_alerts WHERE guild_id=? ORDER BY created_at DESC LIMIT 50").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/music/player", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ playing: false, queue: [], current: null });
  });

  router.get("/api/guild/:id/music/stats", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ totalPlayed: 0 });
  });

  router.get("/api/guild/:id/giveaways", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM giveaways WHERE guild_id=?").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.post("/api/guild/:id/giveaways", requireAuth, requireGuildAccess, async (req, res) => {
    try {
      console.log('[GIVEAWAY BODY]', req.body);
      const { prize, duration, duration_seconds, winners_count, channel_id, message } = req.body;
      const dur = duration_seconds || duration;
      if (!prize || !dur || !channel_id) return res.status(400).json({ error: "Champs manquants" });
      const endsAt = Math.floor(Date.now() / 1000) + parseInt(dur);
      const guild = req.guild;
      const channel = guild.channels.cache.get(channel_id);
      if (!channel) return res.status(404).json({ error: "Salon introuvable" });
      const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require("discord.js");
      const btn = new ButtonBuilder().setCustomId("giveaway_join").setLabel("🎉 Participer").setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder().addComponents(btn);
      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**${prize}**\n\nCliquez sur le bouton pour participer !\n\n**Fin :** <t:${endsAt}:R>\n**Gagnants :** ${winners_count || 1}${message ? "\n\n" + message : ""}`)
        .setTimestamp(endsAt * 1000);
      const msg = await channel.send({ embeds: [embed], components: [row] });
      const result = db.prepare("INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners_count, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(guild.id, channel.id, msg.id, req.session.user.id, prize, winners_count || 1, endsAt);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch(e) { console.error("[GIVEAWAY]", e); res.status(500).json({ error: e.message }); }
  });

  router.get("/api/guild/:id/webhooks", requireAuth, requireGuildAccess, async (req, res) => {
    try { const hooks = await req.guild.fetchWebhooks(); res.json(hooks.map(h => ({ id: h.id, name: h.name, channelId: h.channelId }))); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/audit-log", requireAuth, requireGuildAccess, async (req, res) => {
    try { const logs = await req.guild.fetchAuditLogs({ limit: 20 }); res.json(logs.entries.map(e => ({ id: e.id, action: e.action, executorId: e.executor?.id, reason: e.reason, createdAt: e.createdAt }))); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/backups", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM backups WHERE guild_id=?").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/ai/stats", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ totalMessages: 0, enabled: false });
  });

  router.get("/api/guild/:id/verification/stats", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ total: 0, pending: 0 });
  });

  router.get("/api/guild/:id/tempchannels/active", requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare("SELECT * FROM temp_channels WHERE guild_id=?").all(req.guild.id)); } catch(e) { res.json([]); }
  });

  router.get("/api/guild/:id/statistics", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ messages: 0, commands: 0, joins: 0 });
  });

  router.get("/api/guild/:id/premium", requireAuth, requireGuildAccess, (req, res) => {
    res.json({ active: false });
  });


  // ── Antinuke save ──
  router.post('/api/guild/:id/antinuke', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const fields = [], values = [];
      const allowed = ['enabled','anti_ban','anti_kick','anti_channel_delete','anti_role_delete','anti_mention','anti_webhook','ban_threshold','kick_threshold','channel_delete_threshold','action','alert_channel','punish_role'];
      allowed.forEach(k => { if(req.body[k] !== undefined) { fields.push(k+' = ?'); values.push(req.body[k]); } });
      if(fields.length) { values.push(req.guild.id); db.prepare('UPDATE guild_settings SET '+fields.join(', ')+' WHERE guild_id = ?').run(...values); }
      res.json({ success: true });
    } catch(e) { res.json({ success: true }); }
  });

  // ── Verification save ──
  router.post('/api/guild/:id/verification', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const fields = [], values = [];
      const allowed = ['verification_enabled','verification_channel','verification_role','verification_method','verification_message','verification_question','verification_answer'];
      allowed.forEach(k => { if(req.body[k] !== undefined) { fields.push(k+' = ?'); values.push(req.body[k]); } });
      if(fields.length) { values.push(req.guild.id); db.prepare('UPDATE guild_settings SET '+fields.join(', ')+' WHERE guild_id = ?').run(...values); }
      res.json({ success: true });
    } catch(e) { res.json({ success: true }); }
  });

  // ── Tempchannels save ──
  router.post('/api/guild/:id/tempchannels', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const fields = [], values = [];
      const allowed = ['tempchan_enabled','tempchan_hub','tempchan_category','tempchan_name','tempchan_limit','tempchan_rename','tempchan_limit_perm','tempchan_lock'];
      allowed.forEach(k => { if(req.body[k] !== undefined) { fields.push(k+' = ?'); values.push(req.body[k]); } });
      if(fields.length) { values.push(req.guild.id); db.prepare('UPDATE guild_settings SET '+fields.join(', ')+' WHERE guild_id = ?').run(...values); }
      res.json({ success: true });
    } catch(e) { res.json({ success: true }); }
  });

  // ── Backups ──
  router.post('/api/guild/:id/backups', requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const guild = req.guild;
      const backup = { name: req.body.name || 'Sauvegarde #'+(Date.now()), roles: guild.roles.cache.map(r=>({name:r.name,color:r.hexColor,permissions:r.permissions.bitfield.toString()})), channels: guild.channels.cache.map(c=>({name:c.name,type:c.type})), created_at: new Date().toISOString() };
      db.prepare('INSERT INTO backups (guild_id, name, data) VALUES (?,?,?)').run(guild.id, backup.name, JSON.stringify(backup));
      res.json({ success: true });
    } catch(e) { res.json({ success: true, message: 'Sauvegarde créée' }); }
  });
  router.delete('/api/guild/:id/backups/:bid', requireAuth, requireGuildAccess, (req, res) => {
    try { db.prepare('DELETE FROM backups WHERE id=? AND guild_id=?').run(req.params.bid, req.guild.id); } catch(e) {}
    res.json({ success: true });
  });
  router.post('/api/guild/:id/backups/:bid/restore', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true, message: 'Restauration lancée' });
  });

  // ── AI save ──
  router.post('/api/guild/:id/ai', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const fields = [], values = [];
      const allowed = ['ai_enabled','ai_channel','ai_model','ai_prompt','ai_language','ai_memory','ai_max_tokens'];
      allowed.forEach(k => { if(req.body[k] !== undefined) { fields.push(k+' = ?'); values.push(req.body[k]); } });
      if(fields.length) { values.push(req.guild.id); db.prepare('UPDATE guild_settings SET '+fields.join(', ')+' WHERE guild_id = ?').run(...values); }
      res.json({ success: true });
    } catch(e) { res.json({ success: true }); }
  });
  router.post('/api/guild/:id/ai/chat', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ response: 'Le chatbot IA nécessite une clé API configurée dans le bot.' });
  });

  // ── Music save ──
  router.post('/api/guild/:id/music', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true });
  });
  router.post('/api/guild/:id/music/play', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true, message: 'Commande envoyée au bot' });
  });
  router.post('/api/guild/:id/music/skip', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true });
  });
  router.post('/api/guild/:id/music/stop', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true });
  });

  // ── Statistics ──
  router.get('/api/guild/:id/statistics', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const msgs = db.prepare('SELECT COUNT(*) as count FROM message_logs WHERE guild_id=?').get(req.guild.id);
      res.json({ messages: msgs?.count||0, commands: 0, joins: 0, messagesByDay: [], memberGrowth: [], topMembers: [], topChannels: [], topCommands: [] });
    } catch(e) { res.json({ messages: 0, commands: 0, joins: 0, messagesByDay: [], memberGrowth: [], topMembers: [], topChannels: [], topCommands: [] }); }
  });

  // ── Permissions ──
  router.get('/api/guild/:id/permissions', requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare('SELECT * FROM permissions WHERE guild_id=?').all(req.guild.id)); } catch(e) { res.json([]); }
  });
  router.post('/api/guild/:id/permissions', requireAuth, requireGuildAccess, (req, res) => {
    res.json({ success: true });
  });

  // ── Ticket panels ──
  router.get('/api/guild/:id/ticket-panels', requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare('SELECT * FROM ticket_panels WHERE guild_id=?').all(req.guild.id)); } catch(e) { res.json([]); }
  });
  router.post('/api/guild/:id/ticket-panels', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const { name, embed_title, embed_description, embed_color, button_label, welcome_message } = req.body;
      const { channel_id, category_id, support_role_id } = req.body;
      const r = db.prepare('INSERT INTO ticket_panels (guild_id,name,embed_title,embed_description,embed_color,button_label,welcome_message,channel_id,category_open_id,support_role_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.guild.id, name||'Support', embed_title||'Ouvrir un ticket', embed_description||'Clique pour ouvrir un ticket', embed_color||'#7c3aed', button_label||'Ouvrir un ticket', welcome_message||'Bonjour {user} !', channel_id||null, category_id||null, support_role_id||null);
      res.json({ success: true, id: r.lastInsertRowid });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.patch('/api/guild/:id/ticket-panels/:pid', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const fields = [], values = [];
      const allowed = ['name','embed_title','embed_description','embed_color','button_label','button_style','welcome_message','support_role_id','additional_role_id','category_open_id','name_format','closed_name_format','two_step_close','buttons_per_row','transcript_channel_id','log_channel_id','auto_close_enabled','auto_close_hours','max_tickets','claiming_enabled','escalate_role_id','form_enabled','form_title'];
      // Alias: category_id → category_open_id
      if(req.body.category_id !== undefined) req.body.category_open_id = req.body.category_id;
      allowed.forEach(k => { if(req.body[k] !== undefined) { fields.push(k+' = ?'); values.push(req.body[k]); } });
      if(fields.length) { values.push(req.params.pid, req.guild.id); db.prepare('UPDATE ticket_panels SET '+fields.join(', ')+' WHERE id=? AND guild_id=?').run(...values); }
      res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.delete('/api/guild/:id/ticket-panels/:pid', requireAuth, requireGuildAccess, (req, res) => {
    try { db.prepare('DELETE FROM ticket_panels WHERE id=? AND guild_id=?').run(req.params.pid, req.guild.id); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });
  // ── Ticket Categories ──
  router.get('/api/guild/:id/ticket-panels/:pid/categories', requireAuth, requireGuildAccess, (req, res) => {
    const cats = db.prepare('SELECT * FROM ticket_categories WHERE panel_id = ?').all(req.params.pid);
    res.json(cats);
  });

  router.post('/api/guild/:id/ticket-panels/:pid/categories', requireAuth, requireGuildAccess, (req, res) => {
    const { label, emoji, category_id, support_role_id } = req.body;
    if (!label) return res.status(400).json({ error: 'Label requis' });
    const r = db.prepare('INSERT INTO ticket_categories (panel_id, label, emoji, category_id, support_role_id) VALUES (?,?,?,?,?)').run(req.params.pid, label, emoji||'🎫', category_id||null, support_role_id||null);
    res.json({ success: true, id: r.lastInsertRowid });
  });

  router.delete('/api/guild/:id/ticket-panels/:pid/categories/:cid', requireAuth, requireGuildAccess, (req, res) => {
    db.prepare('DELETE FROM ticket_categories WHERE id = ? AND panel_id = ?').run(req.params.cid, req.params.pid);
    res.json({ success: true });
  });

  router.post('/api/guild/:id/ticket-panels/:pid/send', requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const panel = db.prepare('SELECT * FROM ticket_panels WHERE id=? AND guild_id=?').get(req.params.pid, req.guild.id);
      if (!panel) return res.status(404).json({ error: 'Panel introuvable' });
      const channelId = req.body.channelId || panel.channel_id;
      const ch = req.guild.channels.cache.get(channelId);
      if (!ch) return res.status(400).json({ error: 'Salon introuvable' });
      const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(panel.embed_title || '🎫 Support')
        .setDescription(panel.embed_description || 'Pour créer un ticket, cliquez sur le bouton ci-dessous.')
        .setColor(panel.embed_color || '#7c3aed');
      const button = new ButtonBuilder()
        .setCustomId('ticket_btn_' + panel.id)
        .setLabel(panel.button_label || 'Créer un ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫');
      await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
      res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post('/api/guild/:id/ticket-panels/:pid/deploy', requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const panel = db.prepare('SELECT * FROM ticket_panels WHERE id=? AND guild_id=?').get(req.params.pid, req.guild.id);
      const ch = req.guild.channels.cache.get(req.body.channelId);
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder().setTitle(panel.embed_title).setDescription(panel.embed_description).setColor(panel.embed_color||'#7c3aed');
      const btn = new ButtonBuilder().setCustomId('ticket_open_'+panel.id).setLabel(panel.button_label).setStyle(ButtonStyle.Primary);
      await ch.send({ embeds:[embed], components:[new ActionRowBuilder().addComponents(btn)] });
      res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });

  // ── Reaction roles POST/DELETE ──
  router.post('/api/guild/:id/reactionroles', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const { messageId, channelId, emoji, roleId, mode } = req.body;
      let msg = db.prepare('SELECT * FROM reactionroles WHERE guild_id=? AND message_id=?').get(req.guild.id, messageId);
      db.prepare('INSERT OR IGNORE INTO reactionrole_items (message_id, emoji, role_id, mode) VALUES (?,?,?,?)').run(messageId, emoji, roleId, mode||'toggle');
      res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.delete('/api/guild/:id/reactionroles/:mid', requireAuth, requireGuildAccess, (req, res) => {
    try { db.prepare('DELETE FROM reactionrole_items WHERE message_id=?').run(req.params.mid); db.prepare('DELETE FROM reactionroles WHERE message_id=? AND guild_id=?').run(req.params.mid, req.guild.id); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  // ── Giveaways DELETE ──
  router.post('/api/guild/:id/giveaways/:gid/end', requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const gaw = db.prepare("SELECT * FROM giveaways WHERE id=? AND guild_id=? AND ended=0").get(req.params.gid, req.guild.id);
      if (!gaw) return res.status(404).json({ error: "Giveaway introuvable ou déjà terminé" });
      const { endGiveaway } = require('../commands/admin/giveaway.js');
      await endGiveaway(gaw, req.app.get('client'));
      res.json({ success: true });
    } catch(e) { console.error('[END]', e); res.status(500).json({ error: e.message }); }
  });
  router.post('/api/guild/:id/giveaways/:gid/reroll', requireAuth, requireGuildAccess, async (req, res) => {
    try {
      const gaw = db.prepare("SELECT * FROM giveaways WHERE id=? AND guild_id=?").get(req.params.gid, req.guild.id);
      if (!gaw) return res.status(404).json({ error: "Giveaway introuvable" });
      const entries = JSON.parse(gaw.entries || '[]');
      if (entries.length === 0) return res.status(400).json({ error: "Aucun participant" });
      const { EmbedBuilder } = require('discord.js');
      const winner = entries[Math.floor(Math.random() * entries.length)];
      const channel = req.guild.channels.cache.get(gaw.channel_id);
      if (channel) await channel.send({ embeds: [new EmbedBuilder().setColor(0xFFD700).setTitle("🎉 Reroll !").setDescription(`Nouveau gagnant : <@${winner}> pour **${gaw.prize}** !`)] });
      res.json({ success: true });
    } catch(e) { console.error('[REROLL]', e); res.status(500).json({ error: e.message }); }
  });
  router.delete('/api/guild/:id/giveaways/:gid', requireAuth, requireGuildAccess, (req, res) => {
    try { db.prepare('DELETE FROM giveaways WHERE id=? AND guild_id=?').run(req.params.gid, req.guild.id); res.json({ success: true }); } catch(e) { res.json({ success: true }); }
  });


  router.get('/api/guild/:id/ticket-panels/:pid', requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare('SELECT * FROM ticket_panels WHERE id=? AND guild_id=?').get(req.params.pid, req.guild.id) || {}); } catch(e) { res.json({}); }
  });
  router.get('/api/guild/:id/ticket-panels/:pid/categories', requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare('SELECT * FROM ticket_categories WHERE panel_id=? AND guild_id=?').all(req.params.pid, req.guild.id)); } catch(e) { res.json([]); }
  });
  router.post('/api/guild/:id/ticket-panels/:pid/categories', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const { name, emoji, discord_category_id, support_role_id } = req.body;
      const r = db.prepare('INSERT INTO ticket_categories (panel_id,guild_id,name,emoji,discord_category_id,support_role_id) VALUES (?,?,?,?,?,?)').run(req.params.pid, req.guild.id, name||'Support', emoji||'🎫', discord_category_id||null, support_role_id||null);
      res.json({ success: true, id: r.lastInsertRowid });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });
  router.delete('/api/guild/:id/ticket-panels/:pid/categories/:cid', requireAuth, requireGuildAccess, (req, res) => {
    try { db.prepare('DELETE FROM ticket_categories WHERE id=? AND guild_id=?').run(req.params.cid, req.guild.id); res.json({ success: true }); } catch(e) { res.status(400).json({ error: e.message }); }
  });

  // ── Ticket Messages ──
  router.get('/api/guild/:id/ticket-panels/:pid/messages/:type', requireAuth, requireGuildAccess, (req, res) => {
    try { res.json(db.prepare('SELECT * FROM ticket_messages WHERE panel_id=? AND guild_id=? AND type=?').get(req.params.pid, req.guild.id, req.params.type) || {}); } catch(e) { res.json({}); }
  });
  router.post('/api/guild/:id/ticket-panels/:pid/messages/:type', requireAuth, requireGuildAccess, (req, res) => {
    try {
      const { embed_title, embed_description, embed_color, embed_footer, embed_author } = req.body;
      db.prepare('INSERT INTO ticket_messages (panel_id, guild_id, type, embed_title, embed_description, embed_color, embed_footer, embed_author) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(panel_id, type) DO UPDATE SET embed_title=excluded.embed_title, embed_description=excluded.embed_description, embed_color=excluded.embed_color, embed_footer=excluded.embed_footer, embed_author=excluded.embed_author').run(req.params.pid, req.guild.id, req.params.type, embed_title, embed_description, embed_color, embed_footer, embed_author);
      res.json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
  });

  router.post('/api/guild/:id/ai/test', requireAuth, requireGuildAccess, async (req, res) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.json({ reply: "Clé GROQ_API_KEY manquante dans .env" });
    try {
      const axios = require('axios');
      const settings = getGuildSettings(req.guild.id);
      const prompt = settings.ai_prompt || 'Tu es un assistant Discord amical et utile. Tu reponds en francais.';
      const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.1-8b-instant',
        max_tokens: parseInt(settings.ai_max_tokens) || 500,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: req.body.message || 'Bonjour' }]
      }, { headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' } });
      res.json({ reply: r.data.choices[0].message.content });
    } catch(e) { res.json({ reply: 'Erreur: ' + (e.response?.data?.error?.message || e.message) }); }
  });


  // ── Premium : créer commande PayPal ──
  app.post("/api/premium/create-order", async (req, res) => {
    if (!req.session?.user) return res.status(401).json({ error: "Non connecté" });
    const { plan, type, guildId } = req.body;
    const { PLANS } = require("./premium.js") || require("../utils/premium.js");
    const { createOrder } = require("./paypal.js");
    if (!PLANS[plan]) return res.status(400).json({ error: "Plan invalide" });
    try {
      const order = await createOrder(plan, PLANS[plan].price, guildId || null, req.session.user.id, type || "guild");
      const approveUrl = order.links.find(l => l.rel === "approve")?.href;
      res.json({ orderId: order.id, approveUrl });
    } catch(e) { console.error("[PayPal]", e.response?.data || e.message); res.status(500).json({ error: "Erreur PayPal" }); }
  });

  // ── Premium : succès après paiement ──
  app.get("/premium/success", async (req, res) => {
    const { token, plan, guildId, userId, type } = req.query;
    if (!token || !plan) return res.redirect("/premium/cancel");
    try {
      const { captureOrder } = require("./paypal.js");
      const { PLANS, activatePremium } = require("../utils/premium.js");
      const capture = await captureOrder(token);
      if (capture.status === "COMPLETED") {
        activatePremium({ guildId: guildId || null, userId: userId || req.session?.user?.id, plan, type: type || "guild", paypalOrderId: token, price: PLANS[plan]?.price });
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Premium activé !</title>
        <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;}
        .card{background:#0e0a1a;border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:48px;max-width:400px;}
        h1{font-size:28px;margin-bottom:12px;} p{color:#7c6fa0;margin-bottom:24px;}
        a{display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;}</style></head>
        <body><div class="card"><div style="font-size:48px;margin-bottom:16px">⭐</div>
        <h1>Premium activé !</h1><p>Ton plan <strong>${plan}</strong> est maintenant actif pour 30 jours.</p>
        <a href="/servers">Retour au dashboard</a></div></body></html>`);
      } else {
        res.redirect("/premium/cancel");
      }
    } catch(e) { console.error("[PayPal capture]", e.response?.data || e.message); res.redirect("/premium/cancel"); }
  });

  // ── Premium : annulation ──
  app.get("/premium/cancel", (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Paiement annulé</title>
    <style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#07050f;color:#ede9fe;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;}
    .card{background:#0e0a1a;border:1px solid rgba(255,68,68,0.3);border-radius:16px;padding:48px;max-width:400px;}
    h1{font-size:28px;margin-bottom:12px;} p{color:#7c6fa0;margin-bottom:24px;}
    a{display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;}</style></head>
    <body><div class="card"><div style="font-size:48px;margin-bottom:16px">❌</div>
    <h1>Paiement annulé</h1><p>Ton paiement a été annulé. Aucun montant n'a été débité.</p>
    <a href="/servers">Retour au dashboard</a></div></body></html>`);
  });

  // ── Premium : statut ──
  app.get("/api/premium/status", (req, res) => {
    if (!req.session?.user) return res.json({ premium: false });
    const { getUserPremium } = require("../utils/premium.js");
    const sub = getUserPremium(req.session.user.id);
    res.json({ premium: !!sub, plan: sub?.plan || null, expiresAt: sub?.expires_at || null });
  });

  app.get("/api/guild/:id/premium/status", requireAuth, requireGuildAccess, (req, res) => {
    const { getGuildPremium } = require("../utils/premium.js");
    const sub = getGuildPremium(req.guild.id);
    res.json({ premium: !!sub, plan: sub?.plan || null, expiresAt: sub?.expires_at || null });
  });

  app.use(router);
  return router;
};

// ═══════════════════════════════
//  PREMIUM ROUTES
// ═══════════════════════════════
