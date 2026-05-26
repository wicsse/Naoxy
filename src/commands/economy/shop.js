const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { db, getMemberEconomy } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Voir la boutique du serveur")
    .addIntegerOption(o => o.setName("acheter").setDescription("ID de l'article à acheter")),
  async execute(interaction) {
    const itemId = interaction.options.getInteger("acheter");
    const items = db.prepare("SELECT * FROM shop_items WHERE guild_id = ?").all(interaction.guildId);
    if (itemId) {
      const item = items.find(i => i.id === itemId);
      if (!item) return interaction.reply({ content: "❌ Article introuvable.", flags: 64 });
      const eco = getMemberEconomy(interaction.guildId, interaction.user.id);
      if (eco.balance < item.price) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xff4444).setDescription(`❌ Tu n'as pas assez de pièces ! Il te faut **${item.price}** pièces.`)], flags: 64 });
      db.prepare("UPDATE member_economy SET balance = balance - ? WHERE guild_id = ? AND user_id = ?").run(item.price, interaction.guildId, interaction.user.id);
      if (item.role_id) {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) await member.roles.add(item.role_id).catch(() => {});
      }
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle("🛍️ Achat effectué !").setDescription(`Tu as acheté **${item.emoji} ${item.name}** pour **${item.price} pièces** !`)] });
    }
    if (!items.length) return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setDescription("🛍️ La boutique est vide pour l'instant.")], flags: 64 });
    const embed = new EmbedBuilder().setColor(0x7c3aed).setTitle("🛍️ Boutique du serveur").setTimestamp();
    items.forEach(item => embed.addFields({ name: `${item.emoji} ${item.name} — ${item.price} pièces (ID: ${item.id})`, value: item.description || "Aucune description" }));
    embed.setFooter({ text: "Utilise /shop acheter <ID> pour acheter un article" });
    await interaction.reply({ embeds: [embed] });
  }
};
