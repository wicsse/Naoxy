const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db, getMemberEconomy } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Transférer des pièces à un membre")
    .addUserOption(o => o.setName("membre").setDescription("Membre à payer").setRequired(true))
    .addIntegerOption(o => o.setName("montant").setDescription("Montant à transférer").setRequired(true).setMinValue(1)),
  async execute(interaction) {
    const target = interaction.options.getUser("membre");
    const amount = interaction.options.getInteger("montant");
    if (target.id === interaction.user.id) return interaction.reply({ content: "❌ Tu ne peux pas te payer toi-même !", flags: 64 });
    if (target.bot) return interaction.reply({ content: "❌ Tu ne peux pas payer un bot !", flags: 64 });
    const sender = getMemberEconomy(interaction.guildId, interaction.user.id);
    if (sender.balance < amount) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`❌ Tu n'as pas assez de pièces ! Solde : **${sender.balance}**`)], flags: 64 });
    getMemberEconomy(interaction.guildId, target.id);
    db.prepare("UPDATE member_economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?").run(amount, interaction.guildId, interaction.user.id);
    db.prepare("UPDATE member_economy SET balance = balance + ? WHERE guild_id = ? AND user_id = ?").run(amount, interaction.guildId, target.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("💸 Transfert effectué !").setDescription(`${interaction.user} a envoyé **${amount} pièces** à ${target}`).setTimestamp()] });
  }
};
