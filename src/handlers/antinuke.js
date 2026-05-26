const { AuditLogEvent, EmbedBuilder } = require("discord.js");
const { db } = require("../database/db.js");

const WINDOW = 10_000;
const actionLog = new Map();

function getSettings(guildId) {
  return db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId);
}

function logAlert(guildId, userId, type, detail, action) {
  try {
    db.prepare("INSERT INTO antinuke_alerts (guild_id, user_id, type, detail, action) VALUES (?,?,?,?,?)")
      .run(guildId, userId, type, detail, action);
  } catch (_) {}
}

function track(guildId, userId, type) {
  if (!actionLog.has(guildId)) actionLog.set(guildId, new Map());
  const guild = actionLog.get(guildId);
  if (!guild.has(userId)) guild.set(userId, {});
  const user = guild.get(userId);
  if (!user[type]) user[type] = [];
  const now = Date.now();
  user[type] = user[type].filter(t => now - t < WINDOW);
  user[type].push(now);
  return user[type].length;
}

async function punish(guild, userId, action, punishRoleId, reason) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    if (member.id === guild.ownerId) return;
    const botMember = guild.members.me;
    if (member.roles.highest.position >= botMember.roles.highest.position) return;
    if (action === "ban") await guild.members.ban(userId, { reason }).catch(() => {});
    else if (action === "kick") await member.kick(reason).catch(() => {});
    else if (action === "role" && punishRoleId) await member.roles.set([punishRoleId], reason).catch(() => {});
    else if (action === "strip") await member.roles.set([], reason).catch(() => {});
  } catch (_) {}
}

async function sendAlert(guild, settings, type, executorId, detail, actionTaken) {
  const ch = guild.channels.cache.get(settings.an_alert_channel);
  if (!ch) return;
  ch.send({ embeds: [new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle("🛡️ Anti-Nuke — Alerte")
    .addFields(
      { name: "Type", value: `\`${type}\``, inline: true },
      { name: "Exécuteur", value: `<@${executorId}> (\`${executorId}\`)`, inline: true },
      { name: "Action prise", value: `\`${actionTaken}\``, inline: true },
      { name: "Détail", value: detail },
    )
    .setTimestamp()
  ]}).catch(() => {});
}

async function getAuditExecutor(guild, auditEvent, targetId = null) {
  try {
    await new Promise(r => setTimeout(r, 800));
    const logs = await guild.fetchAuditLogs({ type: auditEvent, limit: 5 });
    const entry = targetId
      ? logs.entries.find(e => e.target?.id === targetId)
      : logs.entries.first();
    return entry?.executor?.id || null;
  } catch (_) { return null; }
}

async function checkChannelDelete(channel) {
  const { guild } = channel;
  const s = getSettings(guild.id);
  if (!s?.antinuke_enabled || !s?.an_delchan) return;
  const executorId = await getAuditExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);
  if (!executorId || executorId === guild.client.user.id || executorId === guild.ownerId) return;
  const count = track(guild.id, executorId, "delchan");
  if (count < (s.an_chan_thresh || 2)) return;
  const action = s.an_action || "ban";
  await punish(guild, executorId, action, s.an_punish_role, "Anti-Nuke: suppression massive de salons");
  logAlert(guild.id, executorId, "delchan", `${count} salons supprimés en ${WINDOW/1000}s`, action);
  await sendAlert(guild, s, "MASS CHANNEL DELETE", executorId, `\`${count}\` salons supprimés en \`${WINDOW/1000}s\``, action);
}

async function checkRoleDelete(role) {
  const { guild } = role;
  const s = getSettings(guild.id);
  if (!s?.antinuke_enabled || !s?.an_delrole) return;
  const executorId = await getAuditExecutor(guild, AuditLogEvent.RoleDelete, role.id);
  if (!executorId || executorId === guild.client.user.id || executorId === guild.ownerId) return;
  const count = track(guild.id, executorId, "delrole");
  if (count < (s.an_chan_thresh || 2)) return;
  const action = s.an_action || "ban";
  await punish(guild, executorId, action, s.an_punish_role, "Anti-Nuke: suppression massive de rôles");
  logAlert(guild.id, executorId, "delrole", `${count} rôles supprimés en ${WINDOW/1000}s`, action);
  await sendAlert(guild, s, "MASS ROLE DELETE", executorId, `\`${count}\` rôles supprimés en \`${WINDOW/1000}s\``, action);
}

async function checkMemberBan(guild, user) {
  const s = getSettings(guild.id);
  if (!s?.antinuke_enabled || !s?.an_massban) return;
  const executorId = await getAuditExecutor(guild, AuditLogEvent.MemberBanAdd, user.id);
  if (!executorId || executorId === guild.client.user.id || executorId === guild.ownerId) return;
  const count = track(guild.id, executorId, "ban");
  if (count < (s.an_ban_thresh || 3)) return;
  const action = s.an_action || "ban";
  await punish(guild, executorId, action, s.an_punish_role, "Anti-Nuke: ban massif");
  logAlert(guild.id, executorId, "massban", `${count} bans en ${WINDOW/1000}s`, action);
  await sendAlert(guild, s, "MASS BAN", executorId, `\`${count}\` membres bannis en \`${WINDOW/1000}s\``, action);
}

async function checkMemberKick(member) {
  const { guild } = member;
  const s = getSettings(guild.id);
  if (!s?.antinuke_enabled || !s?.an_masskick) return;
  const executorId = await getAuditExecutor(guild, AuditLogEvent.MemberKick, member.id);
  if (!executorId || executorId === guild.client.user.id || executorId === guild.ownerId) return;
  const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 3000) return;
  const count = track(guild.id, executorId, "kick");
  if (count < (s.an_kick_thresh || 5)) return;
  const action = s.an_action || "ban";
  await punish(guild, executorId, action, s.an_punish_role, "Anti-Nuke: kick massif");
  logAlert(guild.id, executorId, "masskick", `${count} kicks en ${WINDOW/1000}s`, action);
  await sendAlert(guild, s, "MASS KICK", executorId, `\`${count}\` membres expulsés en \`${WINDOW/1000}s\``, action);
}

async function checkWebhookCreate(channel) {
  const { guild } = channel;
  const s = getSettings(guild.id);
  if (!s?.antinuke_enabled || !s?.an_webhook) return;
  const executorId = await getAuditExecutor(guild, AuditLogEvent.WebhookCreate);
  if (!executorId || executorId === guild.client.user.id || executorId === guild.ownerId) return;
  const count = track(guild.id, executorId, "webhook");
  if (count < 2) return;
  const action = s.an_action || "ban";
  await punish(guild, executorId, action, s.an_punish_role, "Anti-Nuke: webhooks suspects");
  logAlert(guild.id, executorId, "webhook", `${count} webhooks créés en ${WINDOW/1000}s`, action);
  await sendAlert(guild, s, "WEBHOOK SPAM", executorId, `\`${count}\` webhooks créés en \`${WINDOW/1000}s\``, action);
}

module.exports = { checkChannelDelete, checkRoleDelete, checkMemberBan, checkMemberKick, checkWebhookCreate };
