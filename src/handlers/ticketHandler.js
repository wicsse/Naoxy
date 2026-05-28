const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database/db.js");

async function openTicket(interaction) {
  const value = interaction.values[0];
  const guild = interaction.guild;
  const gid = guild.id;

  // Cherche la catégorie custom dans ticket_categories
  const cat = db.prepare("SELECT * FROM ticket_categories WHERE id = ?").get(value);
  const panelDirectId = String(value).startsWith("panel_") ? String(value).replace("panel_","") : null;
  // Cherche le panel lié
  const panel = cat
    ? db.prepare("SELECT * FROM ticket_panels WHERE id = ?").get(cat.panel_id)
    : panelDirectId
    ? db.prepare("SELECT * FROM ticket_panels WHERE id = ?").get(panelDirectId)
    : null;

  // Fallback sur guild_settings si pas de panel configuré
  const settings = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(gid);

  const discordCategoryId = cat?.category_id || panel?.category_open_id || settings?.ticket_category;
  const supportRoleId = cat?.support_role_id || panel?.support_role_id || settings?.ticket_support_role;
  const labelName = cat?.label || panel?.name || value;

  if (!discordCategoryId && !supportRoleId)
    return interaction.reply({ content: "❌ Les tickets ne sont pas configurés.", ephemeral: true });

  const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(gid, interaction.user.id);
  if (existing)
    return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`, ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const count = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?").get(gid)?.c ?? 0) + 1;
  const channelName = `ticket-${String(count).padStart(4, "0")}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const staffRole = guild.roles.cache.get(supportRoleId);
  const category = guild.channels.cache.get(discordCategoryId);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category ?? null,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(staffRole ? [{ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }] : []),
    ],
    reason: `Ticket ouvert par ${interaction.user.tag}`,
  });

  db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, subject, status) VALUES (?, ?, ?, ?, 'open')").run(gid, channel.id, interaction.user.id, labelName);

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close_btn").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger)
  );

  const emoji = cat?.emoji || '🎫';
  const ticketMsg = panel ? db.prepare("SELECT * FROM ticket_panel_messages WHERE panel_id = ? AND type = 'ticket_message'").get(panel.id) : null;
  const msgTitle = ticketMsg?.embed_title || `${emoji} ${labelName}`;
  const msgDesc = (ticketMsg?.embed_description || `Bonjour <@${interaction.user.id}> ! 👋\n\nMerci d'avoir ouvert un ticket. Le staff va vous répondre dès que possible.\n\nDécrivez votre demande ci-dessous.`).replace('{user}', `<@${interaction.user.id}>`);
  const msgColor = ticketMsg?.embed_color ? parseInt(ticketMsg.embed_color.replace('#',''), 16) : 0x5865F2;
  const embed = new EmbedBuilder()
    .setColor(msgColor)
    .setTitle(msgTitle)
    .setDescription(msgDesc)
    .addFields(
      { name: "Ouvert par", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Catégorie", value: `${emoji} ${labelName}`, inline: true }
    )
    .setTimestamp();

  await channel.send({
    content: staffRole ? `<@&${staffRole.id}>` : "",
    embeds: [embed],
    components: [closeBtn]
  });

  await interaction.editReply({ content: `✅ Ton ticket a été créé : ${channel}` });
}

async function closeTicket(interaction) {
  const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
  if (!ticket) return interaction.reply({ content: "❌ Ce salon n'est pas un ticket ouvert.", ephemeral: true });

  db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channelId);

  const settings = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(interaction.guildId);

  if (settings?.log_moderation_channel) {
    const logCh = interaction.guild.channels.cache.get(settings.log_moderation_channel);
    if (logCh) {
      await logCh.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle("🔒 Ticket fermé")
          .addFields(
            { name: "Salon", value: interaction.channel.name, inline: true },
            { name: "Fermé par", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Ouvert par", value: `<@${ticket.user_id}>`, inline: true }
          )
          .setTimestamp()]
      });
    }
  }

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription("🔒 Ticket fermé. Suppression dans 5 secondes...")]
  });

  setTimeout(() => interaction.channel.delete("Ticket fermé").catch(() => {}), 5000);
}

module.exports = { openTicket, closeTicket };
