const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../../database/db.js");
const { successEmbed, errorEmbed, COLORS } = require("../../utils/helpers.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("protect")
    .setDescription("Configurer le système de protection")
    .addSubcommand(s => s.setName("status").setDescription("Voir la configuration actuelle"))
    .addSubcommand(s => s.setName("set").setDescription("Modifier les paramètres")
      .addIntegerOption(o => o.setName("spam_messages").setDescription("Nb messages avant mute (défaut: 5)").setMinValue(2).setMaxValue(20))
      .addIntegerOption(o => o.setName("spam_secondes").setDescription("Intervalle spam en secondes (défaut: 3)").setMinValue(1).setMaxValue(10))
      .addIntegerOption(o => o.setName("mentions_max").setDescription("Nb max de mentions par message (défaut: 5)").setMinValue(2).setMaxValue(20))
      .addIntegerOption(o => o.setName("raid_joins").setDescription("Nb joins pour déclencher anti-raid (défaut: 10)").setMinValue(3).setMaxValue(30))
      .addIntegerOption(o => o.setName("raid_secondes").setDescription("Intervalle raid en secondes (défaut: 10)").setMinValue(3).setMaxValue(30))
      .addIntegerOption(o => o.setName("nuke_actions").setDescription("Nb suppressions pour anti-nuke (défaut: 3)").setMinValue(1).setMaxValue(10))
      .addIntegerOption(o => o.setName("mute_minutes").setDescription("Durée du mute en minutes (défaut: 10)").setMinValue(1).setMaxValue(1440))
      .addChannelOption(o => o.setName("log_salon").setDescription("Salon pour les logs de protection")))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "status") {
      const row = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(gid) || {};
      const embed = new EmbedBuilder()
        .setColor(COLORS.info)
        .setTitle("🛡️ Configuration de la protection")
        .addFields(
          { name: "🔴 Anti-spam", value: `Seuil : **${row.spam_threshold ?? 5}** messages en **${row.spam_interval ?? 3}s**`, inline: false },
          { name: "🔔 Anti-mention spam", value: `Max : **${row.mention_threshold ?? 5}** mentions par message`, inline: false },
          { name: "🚨 Anti-raid", value: `Seuil : **${row.raid_threshold ?? 10}** joins en **${row.raid_interval ?? 10}s**`, inline: false },
          { name: "💣 Anti-nuke", value: `Seuil : **${row.nuke_threshold ?? 3}** suppressions en 30s`, inline: false },
          { name: "⏱️ Durée du mute", value: `**${row.mute_duration ?? 10}** minutes`, inline: false },
          { name: "📋 Salon de logs", value: row.log_channel_id ? `<#${row.log_channel_id}>` : "Auto-détecté", inline: false },
        )
        .setFooter({ text: "Utilisez /protect set pour modifier" });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "set") {
      const updates = {};
      const spam_messages = interaction.options.getInteger("spam_messages");
      const spam_secondes = interaction.options.getInteger("spam_secondes");
      const mentions_max = interaction.options.getInteger("mentions_max");
      const raid_joins = interaction.options.getInteger("raid_joins");
      const raid_secondes = interaction.options.getInteger("raid_secondes");
      const nuke_actions = interaction.options.getInteger("nuke_actions");
      const mute_minutes = interaction.options.getInteger("mute_minutes");
      const log_salon = interaction.options.getChannel("log_salon");

      if (spam_messages) updates.spam_threshold = spam_messages;
      if (spam_secondes) updates.spam_interval = spam_secondes;
      if (mentions_max) updates.mention_threshold = mentions_max;
      if (raid_joins) updates.raid_threshold = raid_joins;
      if (raid_secondes) updates.raid_interval = raid_secondes;
      if (nuke_actions) updates.nuke_threshold = nuke_actions;
      if (mute_minutes) updates.mute_duration = mute_minutes;
      if (log_salon) updates.log_channel_id = log_salon.id;

      if (Object.keys(updates).length === 0)
        return interaction.reply({ embeds: [errorEmbed("Aucun paramètre fourni.")], ephemeral: true });

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

      await interaction.reply({ embeds: [successEmbed("✅ Protection mise à jour !", Object.entries(updates).filter(([k]) => k !== "guild_id").map(([k, v]) => `**${k}** → ${v}`).join("\n"))], ephemeral: true });
    }
  }
};
