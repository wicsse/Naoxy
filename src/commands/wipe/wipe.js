const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wipe')
    .setDescription('Réinitialise tous les salons et rôles du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Seul le propriétaire du serveur peut utiliser cette commande.', ephemeral: true });
    }

    await interaction.reply({ content: '⚠️ Réinitialisation en cours...', ephemeral: true });

    const guild = interaction.guild;

    try {
      const channels = await guild.channels.fetch();
      for (const [, channel] of channels) {
        await channel.delete().catch(() => {});
      }
    } catch (err) {
      console.error('Erreur suppression salons:', err);
    }

    try {
      const roles = await guild.roles.fetch();
      for (const [, role] of roles) {
        if (role.id === guild.id) continue;
        if (!role.editable) continue;
        await role.delete().catch(() => {});
      }
    } catch (err) {
      console.error('Erreur suppression rôles:', err);
    }
  }
};
