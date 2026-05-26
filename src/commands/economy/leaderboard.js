const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Classement du serveur")
    .addStringOption(o => o.setName("type").setDescription("Type de classement").addChoices({ name: "💰 Économie", value: "eco" }, { name: "📈 Niveaux/XP", value: "xp" })),
  async execute(interaction) {
    const type = interaction.options.getString("type") || "eco";
    await interaction.deferReply();
    if (type === "eco") {
      const rows = db.prepare("SELECT * FROM member_economy WHERE guild_id = ? ORDER BY (balance+bank) DESC LIMIT 10").all(interaction.guildId);
      const embed = new EmbedBuilder().setColor(0x7c3aed).setTitle("💰 Classement Économie").setTimestamp();
      const medals = ["🥇", "🥈", "🥉"];
      const lines = await Promise.all(rows.map(async (r, i) => {
        const user = await interaction.client.users.fetch(r.user_id).catch(() => null);
        const name = user ? user.username : r.user_id;
        return `${medals[i] || `**${i+1}.**`} ${name} — **${r.balance + r.bank}** pièces`;
      }));
      embed.setDescription(lines.join("\n") || "Aucune donnée");
      await interaction.editReply({ embeds: [embed] });
    } else {
      const rows = db.prepare("SELECT * FROM member_levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10").all(interaction.guildId);
      const embed = new EmbedBuilder().setColor(0x7c3aed).setTitle("📈 Classement Niveaux").setTimestamp();
      const medals = ["🥇", "🥈", "🥉"];
      const lines = await Promise.all(rows.map(async (r, i) => {
        const user = await interaction.client.users.fetch(r.user_id).catch(() => null);
        const name = user ? user.username : r.user_id;
        return `${medals[i] || `**${i+1}.**`} ${name} — Niveau **${r.level}** (${r.xp} XP)`;
      }));
      embed.setDescription(lines.join("\n") || "Aucune donnée");
      await interaction.editReply({ embeds: [embed] });
    }
  }
};
