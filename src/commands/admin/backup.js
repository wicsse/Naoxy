const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ChannelType
} = require("discord.js");
const { db } = require("../../database/db.js");
const { successEmbed, errorEmbed, infoEmbed, COLORS } = require("../../utils/helpers.js");
const fs = require("fs");
const path = require("path");
const https = require("https");

const BACKUP_DIR = path.join(__dirname, "../../../data/backups");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Télécharge une image en base64
function downloadImageBase64(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null);
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const base64 = `data:${res.headers["content-type"]};base64,${buffer.toString("base64")}`;
        resolve(base64);
      });
      res.on("error", () => resolve(null));
    }).on("error", () => resolve(null));
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Système de backup du serveur")
    .addSubcommand(s => s.setName("create").setDescription("Créer un backup du serveur")
      .addStringOption(o => o.setName("nom").setDescription("Nom du backup (optionnel)").setRequired(false)))
    .addSubcommand(s => s.setName("load").setDescription("Restaurer un backup")
      .addStringOption(o => o.setName("id").setDescription("ID du backup").setRequired(true))
      .addBooleanOption(o => o.setName("purge").setDescription("Supprimer les salons/rôles existants avant ? (défaut: oui)").setRequired(false)))
    .addSubcommand(s => s.setName("list").setDescription("Lister vos backups"))
    .addSubcommand(s => s.setName("delete").setDescription("Supprimer un backup")
      .addStringOption(o => o.setName("id").setDescription("ID du backup").setRequired(true)))
    .addSubcommand(s => s.setName("info").setDescription("Infos sur un backup")
      .addStringOption(o => o.setName("id").setDescription("ID du backup").setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "create") {
      await interaction.deferReply({ ephemeral: true });
      const nom = interaction.options.getString("nom") || `backup-${Date.now()}`;
      const guild = interaction.guild;
      try {
        const data = await captureBackup(guild);
        const backupId = `${guild.id}-${Date.now()}`;
        const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        db.prepare(`INSERT INTO backups (backup_id, guild_id, owner_id, name, file_path, created_at, guild_name, role_count, channel_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(backupId, guild.id, interaction.user.id, nom, filePath, Math.floor(Date.now() / 1000), guild.name, data.roles.length, data.channels.length);
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLORS.success).setTitle("✅ Backup créé !")
          .setDescription(`**Nom :** ${nom}\n**ID :** \`${backupId}\`\n**Rôles :** ${data.roles.length}\n**Salons :** ${data.channels.length}\n**Logo :** ${data.settings.iconBase64 ? "✅ Sauvegardé" : "❌ Aucun"}`)
          .setFooter({ text: "Utilisez /backup load <id> pour restaurer" }).setTimestamp()] });
      } catch (e) {
        console.error(e);
        await interaction.editReply({ embeds: [errorEmbed("Erreur lors de la création.", e.message)] });
      }

    } else if (sub === "load") {
      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getString("id", true);
      const purge = interaction.options.getBoolean("purge") ?? true;
      const guild = interaction.guild;
      const row = db.prepare("SELECT * FROM backups WHERE backup_id = ?").get(id);
      if (!row) return interaction.editReply({ embeds: [errorEmbed("Backup introuvable.")] });
      if (!fs.existsSync(row.file_path)) return interaction.editReply({ embeds: [errorEmbed("Fichier de backup manquant.")] });
      const data = JSON.parse(fs.readFileSync(row.file_path, "utf8"));
      try {
        await interaction.editReply({ embeds: [infoEmbed("⏳ Restauration en cours...", "Cela peut prendre quelques secondes.")] });
        await restoreBackup(guild, data, purge);
        await interaction.editReply({ embeds: [successEmbed("✅ Backup restauré !", `Depuis **${row.name}** (\`${id}\`)\nLogo : ${data.settings.iconBase64 ? "✅ Restauré" : "❌ Non disponible"}`)] });
      } catch (e) {
        console.error(e);
        await interaction.editReply({ embeds: [errorEmbed("Erreur lors de la restauration.", e.message)] });
      }

    } else if (sub === "list") {
      const rows = db.prepare("SELECT * FROM backups WHERE owner_id = ? ORDER BY created_at DESC LIMIT 10").all(interaction.user.id);
      if (rows.length === 0) return interaction.reply({ embeds: [infoEmbed("Aucun backup trouvé.")], ephemeral: true });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle("📦 Vos backups")
        .setDescription(rows.map(r => `**${r.name}**\n> ID: \`${r.backup_id}\` | ${r.guild_name}\n> 🗂️ ${r.channel_count} salons • 👑 ${r.role_count} rôles • <t:${r.created_at}:R>`).join("\n\n"))
        .setFooter({ text: `${rows.length} backup(s)` })], ephemeral: true });

    } else if (sub === "delete") {
      const id = interaction.options.getString("id", true);
      const row = db.prepare("SELECT * FROM backups WHERE backup_id = ? AND owner_id = ?").get(id, interaction.user.id);
      if (!row) return interaction.reply({ embeds: [errorEmbed("Backup introuvable ou vous n'êtes pas le propriétaire.")], ephemeral: true });
      if (fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
      db.prepare("DELETE FROM backups WHERE backup_id = ?").run(id);
      await interaction.reply({ embeds: [successEmbed("🗑️ Supprimé !", `**${row.name}** supprimé.`)], ephemeral: true });

    } else if (sub === "info") {
      const id = interaction.options.getString("id", true);
      const row = db.prepare("SELECT * FROM backups WHERE backup_id = ?").get(id);
      if (!row) return interaction.reply({ embeds: [errorEmbed("Backup introuvable.")], ephemeral: true });
      let data = null;
      if (fs.existsSync(row.file_path)) data = JSON.parse(fs.readFileSync(row.file_path, "utf8"));
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.info).setTitle(`📦 ${row.name}`)
        .addFields(
          { name: "ID", value: `\`${row.backup_id}\``, inline: true },
          { name: "Serveur", value: row.guild_name, inline: true },
          { name: "Créé", value: `<t:${row.created_at}:F>`, inline: true },
          { name: "Rôles", value: `${row.role_count}`, inline: true },
          { name: "Salons", value: `${row.channel_count}`, inline: true },
          { name: "Logo", value: data?.settings?.iconBase64 ? "✅ Disponible" : "❌ Non sauvegardé", inline: true },
        )], ephemeral: true });
    }
  }
};

async function captureBackup(guild) {
  await guild.fetch();
  await guild.roles.fetch();
  await guild.channels.fetch();

  // Télécharger le logo en base64
  const iconURL = guild.iconURL({ size: 1024, extension: "png" });
  const iconBase64 = await downloadImageBase64(iconURL);

  const roles = guild.roles.cache
    .filter(r => !r.managed && r.id !== guild.id)
    .sort((a, b) => a.position - b.position)
    .map(r => ({
      id: r.id, name: r.name, color: r.color, hoist: r.hoist,
      mentionable: r.mentionable, permissions: r.permissions.bitfield.toString(),
      position: r.position,
    }));

  const categories = guild.channels.cache
    .filter(c => c.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      id: c.id, name: c.name, position: c.position,
      permissionOverwrites: c.permissionOverwrites.cache.map(o => ({
        id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString()
      }))
    }));

  const channels = guild.channels.cache
    .filter(c => c.type !== ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      id: c.id, name: c.name, type: c.type, position: c.position, parentId: c.parentId,
      topic: c.topic || null, nsfw: c.nsfw || false,
      rateLimitPerUser: c.rateLimitPerUser || 0,
      bitrate: c.bitrate || null, userLimit: c.userLimit || null,
      permissionOverwrites: c.permissionOverwrites.cache.map(o => ({
        id: o.id, type: o.type, allow: o.allow.bitfield.toString(), deny: o.deny.bitfield.toString()
      }))
    }));

  const settings = {
    name: guild.name,
    iconBase64,
    afkTimeout: guild.afkTimeout,
    preferredLocale: guild.preferredLocale,
    verificationLevel: guild.verificationLevel,
    defaultMessageNotifications: guild.defaultMessageNotifications,
    explicitContentFilter: guild.explicitContentFilter,
  };

  return { roles, categories, channels, settings, capturedAt: Date.now() };
}

async function restoreBackup(guild, data, purge) {
  const roleMap = new Map();
  const channelMap = new Map();

  if (purge) {
    for (const ch of guild.channels.cache.values()) {
      try { await ch.delete("Restauration backup"); } catch (e) { console.error("[Backup] Channel error:", e.message); }
    }
    for (const role of guild.roles.cache.values()) {
      if (role.managed || role.id === guild.id) continue;
      try { await role.delete("Restauration backup"); } catch (e) { console.error("[Backup] Channel error:", e.message); }
    }
  }

  // Restaurer paramètres + logo
  try {
    const editOptions = {
      name: data.settings.name,
      afkTimeout: data.settings.afkTimeout,
      preferredLocale: data.settings.preferredLocale,
      verificationLevel: data.settings.verificationLevel,
      defaultMessageNotifications: data.settings.defaultMessageNotifications,
      explicitContentFilter: data.settings.explicitContentFilter,
    };
    if (data.settings.iconBase64) editOptions.icon = data.settings.iconBase64;
    await guild.edit(editOptions);
  } catch (e) { console.error("[Backup] Erreur settings:", e.message); }

  // Créer les rôles puis repositionner
  const sortedRoles = [...data.roles].sort((a, b) => a.position - b.position);
  const createdRolesList = [];
  for (const r of sortedRoles) {
    try {
      const created = await guild.roles.create({
        name: r.name, color: r.color, hoist: r.hoist,
        mentionable: r.mentionable, permissions: BigInt(r.permissions),
        reason: "Restauration backup",
      });
      roleMap.set(r.id, created.id);
      createdRolesList.push({ role: created.id, position: r.position });
      await new Promise(res => setTimeout(res, 300));
    } catch (e) { console.error('[Backup] Role error:', e.message); }
  }
  try {
    await guild.roles.setPositions(createdRolesList);
    await new Promise(res => setTimeout(res, 1000));
  } catch (e) { console.error('[Backup] setPositions error:', e.message); }

  // Catégories
  for (const cat of data.categories) {
    try {
      const created = await guild.channels.create({
        name: cat.name, type: ChannelType.GuildCategory, position: cat.position,
        permissionOverwrites: buildOverwrites(cat.permissionOverwrites, roleMap, guild.id),
        reason: "Restauration backup",
      });
      channelMap.set(cat.id, created.id);
    } catch (e) { console.error("[Backup] Channel error:", e.message); }
  }

  // Salons
  for (const ch of data.channels) {
    try {
      const options = {
        name: ch.name, type: ch.type, position: ch.position,
        permissionOverwrites: buildOverwrites(ch.permissionOverwrites, roleMap, guild.id),
        reason: "Restauration backup",
      };
      if (ch.parentId && channelMap.has(ch.parentId)) options.parent = channelMap.get(ch.parentId);
      if (ch.topic) options.topic = ch.topic;
      if (ch.nsfw) options.nsfw = ch.nsfw;
      if (ch.rateLimitPerUser) options.rateLimitPerUser = ch.rateLimitPerUser;
      if (ch.bitrate) options.bitrate = ch.bitrate;
      if (ch.userLimit) options.userLimit = ch.userLimit;
      const created = await guild.channels.create(options);
      channelMap.set(ch.id, created.id);
    } catch (e) { console.error("[Backup] Channel error:", e.message); }
  }
}

function buildOverwrites(overwrites, roleMap, guildId) {
  return overwrites.map(o => ({
    id: o.type === 0 ? (roleMap.get(o.id) || guildId) : o.id,
    type: o.type,
    allow: BigInt(o.allow),
    deny: BigInt(o.deny),
  }));
}
