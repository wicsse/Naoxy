const { db } = require("../database/db.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    // Bouton rôle
    if (interaction.isButton() && interaction.customId.startsWith("rr_btn_")) {
      const roleId = interaction.customId.replace("rr_btn_", "");
      const member = interaction.member;
      try {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          return interaction.reply({ content: `✅ Rôle <@&${roleId}> retiré.`, ephemeral: true });
        } else {
          await member.roles.add(roleId);
          return interaction.reply({ content: `✅ Rôle <@&${roleId}> donné.`, ephemeral: true });
        }
      } catch {
        return interaction.reply({ content: "❌ Impossible de modifier ce rôle.", ephemeral: true });
      }
    }

    // Menu déroulant rôle
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("rr_select_")) {
      const roleId = interaction.values[0];
      const member = interaction.member;
      try {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId);
          return interaction.reply({ content: `✅ Rôle <@&${roleId}> retiré.`, ephemeral: true });
        } else {
          await member.roles.add(roleId);
          return interaction.reply({ content: `✅ Rôle <@&${roleId}> donné.`, ephemeral: true });
        }
      } catch {
        return interaction.reply({ content: "❌ Impossible de modifier ce rôle.", ephemeral: true });
      }
    }
  }
};
