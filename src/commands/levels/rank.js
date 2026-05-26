const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { getMemberLevel, levelFromXp, xpForLevel } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Voir ton niveau ou celui d'un membre")
    .addUserOption(o => o.setName("membre").setDescription("Membre à consulter")),
  async execute(interaction) {
    const target = interaction.options.getUser("membre") || interaction.user;
    const data = getMemberLevel(interaction.guildId, target.id);
    const level = levelFromXp(data.xp);
    const currentXp = data.xp - Array.from({length: level}, (_, i) => xpForLevel(i)).reduce((a, b) => a + b, 0);
    const needed = xpForLevel(level);
    const progress = Math.floor((currentXp / needed) * 20);
    const bar = "█".repeat(progress) + "░".repeat(20 - progress);
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`📈 Niveau de ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "🏆 Niveau", value: `**${level}**`, inline: true },
        { name: "✨ XP Total", value: `**${data.xp}**`, inline: true },
        { name: "💬 Messages", value: `**${data.messages}**`, inline: true },
        { name: `Progression vers niveau ${level + 1}`, value: `\`${bar}\` ${currentXp}/${needed} XP` }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
