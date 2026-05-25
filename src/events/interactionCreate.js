const { Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
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
      if (interaction.customId === "ticket_open") {
        const catId = interaction.values[0]; // C'est l'ID de la ligne dans ticket_categories
        
        // On récupère la configuration de la catégorie depuis la DB
        const cat = db.prepare("SELECT * FROM ticket_categories WHERE id = ? AND guild_id = ?").get(catId, gid);
        if (!cat) return interaction.reply({ embeds: [errorEmbed("Configuration introuvable", "Cette catégorie n'existe plus ou a été modifiée.")], ephemeral: true });

        const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(gid, interaction.user.id);
        if (existing) return interaction.reply({ embeds: [errorEmbed("Ticket déjà ouvert", `Tu as déjà un ticket ouvert : <#${existing.channel_id}>`)], ephemeral: true });

        const category = interaction.guild.channels.cache.get(cat.category_id);
        if (!category) return interaction.reply({ embeds: [errorEmbed("Catégorie introuvable.", "La catégorie Discord configurée pour ce bouton est introuvable.")], ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        const ticketCount = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?").get(gid);
        const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}-${ticketCount.count + 1}`;

        const permissionOverwrites = [
          { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ];

        // Rôle support spécifique à la catégorie OU rôle support global du serveur
        const targetSupportRole = cat.support_role_id || settings?.ticket_support_role;
        if (targetSupportRole) {
          permissionOverwrites.push({
            id: targetSupportRole,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages]
          });
        }

        const channel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: cat.category_id,
          permissionOverwrites,
        });

        db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, status) VALUES (?, ?, ?, 'open')").run(gid, channel.id, interaction.user.id);

        const closeBtn = new ButtonBuilder().setCustomId("ticket_close_btn").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(closeBtn);

        await channel.send({
          content: `${interaction.user}${targetSupportRole ? ` <@&${targetSupportRole}>` : ""}`,
          embed: [new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle(`${cat.emoji} ${cat.label}`)
            .setDescription(`Bonjour ${interaction.user} ! 👋\nDécrivez votre demande et un membre du staff vous répondra dès que possible.`)
            .addFields(
              { name: "Ouvert par", value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
              { name: "Catégorie", value: cat.label, inline: true }
            )
            .setTimestamp()],
          components: [row]
        });

        await interaction.editReply({ embeds: [successEmbed("✅ Ticket ouvert !", `Ton ticket a été créé : ${channel}`)] });
      }
    }

    // ── Buttons ──
    if (interaction.isButton()) {

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
        const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
        if (!ticket) return;

        db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channelId);

        await interaction.reply({
          embeds: [new EmbedBuilder().setColor(COLORS.error).setTitle("🔒 Ticket fermé").setDescription(`Fermé par ${interaction.user}.\nSuppression dans 5 secondes...`)]
        });

        setTimeout(async () => { await interaction.channel.delete().catch(() => {}); }, 5000);
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
