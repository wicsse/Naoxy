const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../../database/db.js");
const { successEmbed, errorEmbed, COLORS } = require("../../utils/helpers.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configurer les salons de logs")
    .addSubcommand(s => s.setName("setup").setDescription("Définir les salons de logs")
      .addChannelOption(o => o.setName("messages").setDescription("Logs des messages").setRequired(false))
      .addChannelOption(o => o.setName("membres").setDescription("Logs des membres").setRequired(false))
      .addChannelOption(o => o.setName("moderation").setDescription("Logs de modération").setRequired(false))
      .addChannelOption(o => o.setName("serveur").setDescription("Logs serveur (salons, rôles, vocal)").setRequired(false)))
    .addSubcommand(s => s.setName("status").setDescription("Voir les salons de logs configurés"))
    .addSubcommand(s => s.setName("reset").setDescription("Réinitialiser les logs"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "setup") {
      const messages   = interaction.options.getChannel("messages");
      const membres    = interaction.options.getChannel("membres");
      const moderation = interaction.options.getChannel("moderation");
      const serveur    = interaction.options.getChannel("serveur");

      if (!messages && !membres && !moderation && !serveur)
        return interaction.reply({ embeds: [errorEmbed("Aucun salon fourni.")], ephemeral: true });

      const updates = {};
      if (messages)   updates.log_messages_channel   = messages.id;
      if (membres)    updates.log_membres_channel     = membres.id;
      if (moderation) updates.log_moderation_channel  = moderation.id;
      if (serveur)    updates.log_serveur_channel     = serveur.id;

      const existing = db.prepare("SELECT guild_id FROM guild_settings WHERE guild_id = ?").get(gid);
      if (existing) {
        const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(", ");
        db.prepare(`UPDATE guild_settings SET ${setClauses} WHERE guild_id = ?`).run(...Object.values(updates), gid);
      } else {
        updates.guild_id = gid;
        const keys = Object.keys(updates).join(", ");
        const placeholders = Object.keys(updates).map(() => "?").join(", ");
        db.prepare(`INSERT INTO guild_settings (${keys}) VALUES (${placeholders})`).run(...Object.values(updates));
      }

      await interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle("✅ Logs configurés !")
        .addFields(
          { name: "📝 Messages",    value: messages   ? `${messages}`   : "*inchangé*", inline: true },
          { name: "👥 Membres",     value: membres    ? `${membres}`    : "*inchangé*", inline: true },
          { name: "🔨 Modération",  value: moderation ? `${moderation}` : "*inchangé*", inline: true },
          { name: "⚙️ Serveur",     value: serveur    ? `${serveur}`    : "*inchangé*", inline: true },
        )
        .setTimestamp()], ephemeral: true });

    } else if (sub === "status") {
      const row = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(gid) || {};
      await interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle("📋 Salons de logs")
        .addFields(
          { name: "📝 Messages",   value: row.log_messages_channel   ? `<#${row.log_messages_channel}>`   : "❌ Non configuré", inline: true },
          { name: "👥 Membres",    value: row.log_membres_channel    ? `<#${row.log_membres_channel}>`    : "❌ Non configuré", inline: true },
          { name: "🔨 Modération", value: row.log_moderation_channel ? `<#${row.log_moderation_channel}>` : "❌ Non configuré", inline: true },
          { name: "⚙️ Serveur",    value: row.log_serveur_channel    ? `<#${row.log_serveur_channel}>`    : "❌ Non configuré", inline: true },
        )], ephemeral: true });

    } else if (sub === "reset") {
      db.prepare("UPDATE guild_settings SET log_messages_channel = NULL, log_membres_channel = NULL, log_moderation_channel = NULL, log_serveur_channel = NULL WHERE guild_id = ?").run(gid);
      await interaction.reply({ embeds: [successEmbed("✅ Logs réinitialisés !")], ephemeral: true });
    }
  }
};
