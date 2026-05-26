const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getMemberEconomy } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Voir ton solde de pièces")
    .addUserOption(o => o.setName("membre").setDescription("Membre à consulter")),
  async execute(interaction) {
    const target = interaction.options.getUser("membre") || interaction.user;
    const eco = getMemberEconomy(interaction.guildId, target.id);
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`💰 Solde de ${target.username}`)
      .addFields(
        { name: "👛 Portefeuille", value: `**${eco.balance}** pièces`, inline: true },
        { name: "🏦 Banque", value: `**${eco.bank}** pièces`, inline: true },
        { name: "💎 Total", value: `**${eco.balance + eco.bank}** pièces`, inline: true }
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
