const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { db, levelFromXp } = require("../../database/db.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setxp")
    .setDescription("Définir l'XP d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName("membre").setDescription("Membre").setRequired(true))
    .addIntegerOption(o => o.setName("xp").setDescription("Montant d'XP").setRequired(true).setMinValue(0)),
  async execute(interaction) {
    const target = interaction.options.getUser("membre");
    const xp = interaction.options.getInteger("xp");
    db.prepare("UPDATE member_levels SET xp = ?, level = ? WHERE guild_id = ? AND user_id = ?").run(xp, levelFromXp(xp), interaction.guildId, target.id);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x22c55e).setDescription(`✅ L'XP de ${target} a été défini à **${xp}** (niveau **${levelFromXp(xp)}**)`)] });
  }
};
