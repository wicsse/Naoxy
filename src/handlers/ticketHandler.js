const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder } = require("discord.js");
const { db } = require("../database/db.js");

async function handleTicketButton(interaction) {
  const gid = interaction.guildId;
  const panels = db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ?').all(gid);

  if (panels.length > 1) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_open_panel')
      .setPlaceholder('Choisir le sujet')
      .addOptions(panels.slice(0, 25).map(p => ({
        label: p.name || p.embed_title || 'Support',
        value: String(p.id),
        emoji: '🎫'
      })));

    const cancelBtn = new ButtonBuilder()
      .setCustomId('ticket_cancel')
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Danger);

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#7c3aed')
        .setTitle('Ouvrir un ticket')
        .setDescription('Bonjour, votre demande a bien été prise en compte, pour procéder à la suite veuillez choisir le sujet de votre demande:')],
      components: [
        new ActionRowBuilder().addComponents(menu),
        new ActionRowBuilder().addComponents(cancelBtn)
      ],
      flags: 64
    });
  }

  const panelId = interaction.customId.replace('ticket_btn_', '');
  const panel = db.prepare('SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?').get(panelId, gid) || panels[0];
  if (!panel) return interaction.reply({ content: '❌ Panel introuvable.', flags: 64 });
  await createTicket(interaction, panel, null);
}

async function handleTicketSelect(interaction) {
  const gid = interaction.guildId;
  const panelId = interaction.values[0];
  const panel = db.prepare('SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?').get(panelId, gid);
  if (!panel) return interaction.reply({ content: '❌ Panel introuvable.', flags: 64 });
  await createTicket(interaction, panel, null);
}

async function createTicket(interaction, panel, cat) {
  const guild = interaction.guild;
  const gid = guild.id;

  const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(gid, interaction.user.id);
  if (existing) return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`, flags: 64 });

  await interaction.deferReply({ flags: 64 });

  const count = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?").get(gid)?.c ?? 0) + 1;
  const nameFormat = panel.name_format || 'ticket-{count}-{username}';
  const channelName = nameFormat
    .replace('{count}', String(count).padStart(4, '0'))
    .replace('{username}', interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .slice(0, 100);

  const categoryId = panel.category_open_id || panel.category_id;
  const supportRoleId = panel.support_role_id;
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

  db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, subject, status) VALUES (?, ?, ?, ?, 'open')").run(gid, channel.id, interaction.user.id, panel.name || 'Support');

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close_btn").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger)
  );

  const rawMsg = panel.ticket_open_message || panel.welcome_message || 'Bonjour {user} ! 👋\n\nMerci d\'avoir ouvert un ticket. Le staff va vous répondre dès que possible.\n\nDécrivez votre demande ci-dessous.';
  const welcome = rawMsg
    .replace(/\{user\}/g, `<@${interaction.user.id}>`)
    .replace(/\{username\}/g, interaction.user.username)
    .replace(/\{server\}/g, guild.name);

  const embed = new EmbedBuilder()
    .setColor(panel.embed_color || '#7c3aed')
    .setTitle(panel.name || panel.embed_title || '🎫 Ticket')
    .setDescription(welcome)
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
  if (!ticket) return interaction.reply({ content: "❌ Ce salon n'est pas un ticket ouvert.", flags: 64 });

  db.prepare("UPDATE tickets SET status = 'closed' WHERE channel_id = ?").run(interaction.channelId);

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription('🔒 Ticket fermé. Suppression dans 5 secondes...')]
  });

  setTimeout(() => interaction.channel.delete('Ticket fermé').catch(() => {}), 5000);
}

module.exports = { handleTicketButton, handleTicketSelect, closeTicket };
