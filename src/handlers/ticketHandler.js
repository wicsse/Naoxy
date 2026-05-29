const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require("discord.js");
const { db } = require("../database/db.js");

async function handleTicketButton(interaction) {
  const panelId = interaction.customId.replace('ticket_btn_', '');
  const panel = db.prepare('SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?').get(panelId, interaction.guildId);
  if (!panel) return interaction.reply({ content: '❌ Panel introuvable.', ephemeral: true });

  const categories = db.prepare('SELECT * FROM ticket_categories WHERE panel_id = ?').all(panelId);

  if (categories.length > 0) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_open_' + panelId)
      .setPlaceholder('Choisir une catégorie')
      .addOptions(categories.map(c => ({
        label: c.label || 'Support',
        value: String(c.id),
        emoji: c.emoji || '🎫'
      })));

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(panel.embed_color || '#7c3aed')
        .setTitle(panel.embed_title || 'Support')
        .setDescription('Choisissez une catégorie pour ouvrir un ticket.')],
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  }

  await createTicket(interaction, panel, null);
}

async function handleTicketSelect(interaction) {
  const panelId = interaction.customId.replace('ticket_open_', '');
  const panel = db.prepare('SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?').get(panelId, interaction.guildId);
  if (!panel) return interaction.reply({ content: '❌ Panel introuvable.', ephemeral: true });

  const catId = interaction.values[0];
  const cat = db.prepare('SELECT * FROM ticket_categories WHERE id = ?').get(catId);

  await createTicket(interaction, panel, cat);
}

async function createTicket(interaction, panel, cat) {
  const guild = interaction.guild;
  const gid = guild.id;

  const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(gid, interaction.user.id);
  if (existing) return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`, ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const count = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?").get(gid)?.c ?? 0) + 1;
  const nameFormat = panel.name_format || 'ticket-{count}-{username}';
  const channelName = nameFormat
    .replace('{count}', String(count).padStart(4, '0'))
    .replace('{username}', interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .slice(0, 100);

  const categoryId = cat?.category_id || panel.category_open_id || panel.category_id;
  const supportRoleId = cat?.support_role_id || panel.support_role_id;
  const staffRole = supportRoleId ? guild.roles.cache.get(supportRoleId) : null;
  const category = categoryId ? guild.channels.cache.get(categoryId) : null;

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

  db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, subject, status) VALUES (?, ?, ?, ?, 'open')").run(gid, channel.id, interaction.user.id, cat?.label || 'Support');

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close_btn").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger)
  );

  const welcome = panel.welcome_message || 'Bonjour {user} ! Décrivez votre demande et le staff vous répondra dès que possible.';
  const embed = new EmbedBuilder()
    .setColor(panel.embed_color || '#7c3aed')
    .setTitle(cat?.label || panel.embed_title || '🎫 Ticket')
    .setDescription(welcome.replace('{user}', `<@${interaction.user.id}>`))
    .addFields(
      { name: 'Ouvert par', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Catégorie', value: cat?.label || 'Support', inline: true }
    )
    .setTimestamp();

  await channel.send({
    content: staffRole ? `<@&${staffRole.id}>` : `<@${interaction.user.id}>`,
    embeds: [embed],
    components: [closeBtn]
  });

  await interaction.editReply({ content: `✅ Ton ticket a été créé : ${channel}` });
}

async function closeTicket(interaction) {
  const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
  if (!ticket) return interaction.reply({ content: '❌ Ce salon n\'est pas un ticket ouvert.', ephemeral: true });

  db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channelId);

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription('🔒 Ticket fermé. Suppression dans 5 secondes...')]
  });

  setTimeout(() => interaction.channel.delete('Ticket fermé').catch(() => {}), 5000);
}

module.exports = { handleTicketButton, handleTicketSelect, closeTicket };
