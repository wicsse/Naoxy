const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kickall')
    .setDescription('Kick tous les membres du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    await interaction.reply({ content: '⚠️ Kick de tous les membres en cours...', ephemeral: true });

    const guild = interaction.guild;
    const members = await guild.members.fetch();

    for (const [, member] of members) {
      if (member.id === interaction.user.id) continue;
      if (member.id === guild.client.user.id) continue;
      if (!member.kickable) continue;
      await member.kick('kickall command').catch(() => {});
    }
  }
};
