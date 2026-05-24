const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require("discord.js");
const { db } = require("../database/db.js");

// ─── STOCKAGE EN MÉMOIRE ──────────────────────────────────────────────────────
const spamMap = new Map();      // userId -> [timestamps]
const mentionMap = new Map();   // userId -> [timestamps]
const joinMap = new Map();      // guildId -> [timestamps]
const nukeMap = new Map();      // userId -> { channels: n, roles: n, lastReset: ts }

const DEFAULTS = {
  spam_threshold: 5,       // messages en X secondes
  spam_interval: 3,        // secondes
  mention_threshold: 5,    // mentions par message
  raid_threshold: 10,      // joins en X secondes
  raid_interval: 10,       // secondes
  nuke_threshold: 3,       // suppressions de salons/rôles
  mute_duration: 10,       // minutes
};

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────
function getSettings(guildId) {
  const row = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId);
  return { ...DEFAULTS, ...row };
}

async function muteUser(guild, userId, reason, duration, logChannel) {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member || member.permissions.has(PermissionFlagsBits.Administrator)) return;

    let muteRole = guild.roles.cache.find(r => r.name === "Muted" || r.name === "muted");
    if (!muteRole) {
      muteRole = await guild.roles.create({
        name: "Muted",
        permissions: [],
        reason: "Création auto pour le système de protection",
      });
      for (const ch of guild.channels.cache.values()) {
        await ch.permissionOverwrites.edit(muteRole, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
        }).catch(() => {});
      }
    }

    await member.roles.add(muteRole, reason);
    setTimeout(async () => {
      await member.roles.remove(muteRole, "Fin du mute auto").catch(() => {});
    }, duration * 60 * 1000);

    if (logChannel) {
      await logChannel.send({ embeds: [new EmbedBuilder()
        .setColor(0xFF4444)
        .setTitle("🛡️ Protection — Mute automatique")
        .setDescription(`**Utilisateur :** <@${userId}>\n**Raison :** ${reason}\n**Durée :** ${duration} minutes`)
        .setTimestamp()] });
    }
  } catch (e) {
    console.error("[Protection] Erreur mute:", e.message);
  }
}

function getLogChannel(guild) {
  const settings = getSettings(guild.id);
  if (settings.log_channel_id) return guild.channels.cache.get(settings.log_channel_id);
  return guild.channels.cache.find(c =>
    c.type === ChannelType.GuildText &&
    (c.name.includes("log") || c.name.includes("audit") || c.name.includes("mod"))
  );
}

// ─── ANTI-SPAM ───────────────────────────────────────────────────────────────
async function checkSpam(message) {
  if (!message.guild || message.author.bot) return;
  const member = message.member;
  if (!member || member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const settings = getSettings(message.guild.id);
  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();

  if (!spamMap.has(key)) spamMap.set(key, []);
  const timestamps = spamMap.get(key).filter(t => now - t < settings.spam_interval * 1000);
  timestamps.push(now);
  spamMap.set(key, timestamps);

  if (timestamps.length >= settings.spam_threshold) {
    spamMap.delete(key);
    const logCh = getLogChannel(message.guild);
    await muteUser(message.guild, message.author.id, `Anti-spam : ${timestamps.length} messages en ${settings.spam_interval}s`, settings.mute_duration, logCh);
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0xFF4444)
      .setDescription(`🛡️ <@${message.author.id}> a été mute **${settings.mute_duration} min** pour spam.`)] })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
  }
}

// ─── ANTI-MENTION SPAM ───────────────────────────────────────────────────────
async function checkMentions(message) {
  if (!message.guild || message.author.bot) return;
  const member = message.member;
  if (!member || member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const settings = getSettings(message.guild.id);
  const mentionCount = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 5 : 0);

  if (mentionCount >= settings.mention_threshold) {
    await message.delete().catch(() => {});
    const logCh = getLogChannel(message.guild);
    await muteUser(message.guild, message.author.id, `Anti-mention spam : ${mentionCount} mentions`, settings.mute_duration, logCh);
    await message.channel.send({ embeds: [new EmbedBuilder()
      .setColor(0xFF4444)
      .setDescription(`🛡️ <@${message.author.id}> a été mute **${settings.mute_duration} min** pour mention spam.`)] })
      .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
  }
}

// ─── ANTI-RAID ───────────────────────────────────────────────────────────────
async function checkRaid(member) {
  const guild = member.guild;
  const settings = getSettings(guild.id);
  const now = Date.now();

  if (!joinMap.has(guild.id)) joinMap.set(guild.id, []);
  const joins = joinMap.get(guild.id).filter(t => now - t < settings.raid_interval * 1000);
  joins.push(now);
  joinMap.set(guild.id, joins);

  if (joins.length >= settings.raid_threshold) {
    joinMap.set(guild.id, []);
    const logCh = getLogChannel(guild);

    // Lockdown — désactiver les invitations et kick les nouveaux comptes
    const recentMembers = guild.members.cache
      .filter(m => !m.user.bot && (now - m.joinedTimestamp) < settings.raid_interval * 1000);

    for (const m of recentMembers.values()) {
      await m.kick("Anti-raid : raid détecté").catch(() => {});
    }

    if (logCh) {
      await logCh.send({ embeds: [new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle("🚨 RAID DÉTECTÉ")
        .setDescription(`**${joins.length} membres** ont rejoint en **${settings.raid_interval}s**.\n${recentMembers.size} membres kicked automatiquement.`)
        .setTimestamp()] });
    }
  }
}

// ─── ANTI-NUKE ───────────────────────────────────────────────────────────────
async function checkNuke(executor, guild, type) {
  if (!executor || executor.bot) return;
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member || member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const settings = getSettings(guild.id);
  const key = `${guild.id}-${executor.id}`;
  const now = Date.now();

  if (!nukeMap.has(key)) nukeMap.set(key, { count: 0, lastReset: now });
  const data = nukeMap.get(key);

  if (now - data.lastReset > 30000) {
    data.count = 0;
    data.lastReset = now;
  }

  data.count++;
  nukeMap.set(key, data);

  if (data.count >= settings.nuke_threshold) {
    nukeMap.delete(key);
    const logCh = getLogChannel(guild);
    await muteUser(guild, executor.id, `Anti-nuke : ${data.count} suppressions de ${type} en 30s`, settings.mute_duration, logCh);
  }
}

module.exports = { checkSpam, checkMentions, checkRaid, checkNuke };
