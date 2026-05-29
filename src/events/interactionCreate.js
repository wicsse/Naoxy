const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const { handleTicketButton, handleTicketSelect, closeTicket } = require("../handlers/ticketHandler.js");
const { db, getGuildSettings } = require("../database/db.js");
const { COLORS, successEmbed, errorEmbed } = require("../utils/helpers.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {

    // ── Slash Commands ──
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try { await command.execute(interaction); } catch (e) { console.error(e); }
      return;
    }

    const gid = interaction.guildId;
    const settings = getGuildSettings(gid);

    // ── Select Menu (Tickets) ──
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith("ticket_open_")) {
        return handleTicketSelect(interaction);
      }
    }

    // ── Buttons ──
    if (interaction.isButton()) {

      if (interaction.customId.startsWith("ticket_btn_")) {
        return handleTicketButton(interaction);
      }

      if (interaction.customId === "ticket_close_btn") {
        const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
        if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ce salon n'est pas un ticket ouvert.")], ephemeral: true });

        const closeBtn = new ButtonBuilder().setCustomId("ticket_confirm_close").setLabel("✅ Confirmer").setStyle(ButtonStyle.Danger);
        const cancelBtn = new ButtonBuilder().setCustomId("ticket_cancel_close").setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(closeBtn, cancelBtn);

        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(COLORS.warning).setTitle("🔒 Fermer le ticket ?").setDescription("Confirmez-vous la fermeture de ce ticket ?")],
          components: [row]
        });
      }

      if (interaction.customId === "ticket_confirm_close") {
        return closeTicket(interaction);
      }

      if (interaction.customId === "ticket_cancel_close") {
        await interaction.reply({ embeds: [successEmbed("Fermeture annulée")], ephemeral: true });
      }



      // ── Reaction Roles ──
      if (interaction.customId.startsWith('rr_btn_')) {
        const roleId = interaction.customId.replace('rr_btn_', '');
        const member = interaction.member;
        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            return interaction.reply({ embeds: [errorEmbed('Rôle retiré !', `Le rôle <@&${roleId}> vous a été retiré.`)], ephemeral: true });
          } else {
            await member.roles.add(roleId);
            return interaction.reply({ embeds: [successEmbed('Rôle ajouté !', `Le rôle <@&${roleId}> vous a été donné.`)], ephemeral: true });
          }
        } catch (e) {
          return interaction.reply({ embeds: [errorEmbed('Erreur', 'Impossible de modifier votre rôle.')], ephemeral: true });
        }
      }

      if (interaction.customId.startsWith('rr_select_')) {
        const roleId = interaction.values[0];
        const member = interaction.member;
        try {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
            return interaction.reply({ embeds: [errorEmbed('Rôle retiré !', `Le rôle <@&${roleId}> vous a été retiré.`)], ephemeral: true });
          } else {
            await member.roles.add(roleId);
            return interaction.reply({ embeds: [successEmbed('Rôle ajouté !', `Le rôle <@&${roleId}> vous a été donné.`)], ephemeral: true });
          }
        } catch (e) {
          return interaction.reply({ embeds: [errorEmbed('Erreur', 'Impossible de modifier votre rôle.')], ephemeral: true });
        }
      }

      // ── Giveaway ──
      if (interaction.customId === "giveaway_join") {
        const gaw = db.prepare("SELECT * FROM giveaways WHERE message_id = ? AND ended = 0").get(interaction.message.id);
        if (!gaw) return interaction.reply({ embeds: [errorEmbed("Ce giveaway est terminé.")], ephemeral: true });

        const entries = JSON.parse(gaw.entries);
        if (entries.includes(interaction.user.id)) {
          return interaction.reply({ embeds: [errorEmbed("Vous participez déjà !")], ephemeral: true });
        }
        entries.push(interaction.user.id);
        db.prepare("UPDATE giveaways SET entries = ? WHERE id = ?").run(JSON.stringify(entries), gaw.id);
        await interaction.reply({ embeds: [successEmbed("🎉 Participation enregistrée !", `Vous participez au giveaway **${gaw.prize}** !`)], ephemeral: true });
      }
    }
  }
};
