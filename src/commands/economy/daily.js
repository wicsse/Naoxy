const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db, getMemberEconomy } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Récupère ta récompense quotidienne"),
  async execute(interaction) {
    const eco = getMemberEconomy(interaction.guildId, interaction.user.id);
    const now = Math.floor(Date.now() / 1000);
    const cooldown = 86400;
    const remaining = (eco.last_daily + cooldown) - now;
    if (remaining > 0) {
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`⏰ Tu as déjà récupéré ta récompense ! Reviens dans **${h}h ${m}m**.`)], flags: 64 });
    }
    const amount = Math.floor(Math.random() * 200) + 100;
    db.prepare("UPDATE member_economy SET balance = balance + ?, last_daily = ? WHERE guild_id = ? AND user_id = ?").run(amount, now, interaction.guildId, interaction.user.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("💰 Récompense quotidienne !").setDescription(`Tu as reçu **${amount} pièces** !\nNouveau solde : **${eco.balance + amount} pièces**`).setTimestamp()] });
  }
};
