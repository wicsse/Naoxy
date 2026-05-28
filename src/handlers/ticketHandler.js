const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require("discord.js");
const { db } = require("../database/db.js");

const CATEGORY_NAMES = {
  support: "🎧 Support général",
  commande: "🛒 Commande / Achat",
  autre: "📩 Autre",
};

async function openTicket(interaction) {
  const value = interaction.values[0];
  const guild = interaction.guild;
  const gid = guild.id;

  const settings = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(gid);

  if (!settings?.ticket_category || !settings?.ticket_support_role)
    return interaction.reply({ content: "❌ Les tickets ne sont pas configurés. Utilisez `/ticket panel`.", ephemeral: true });

  const existing = db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(gid, interaction.user.id);
  if (existing)
    return interaction.reply({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`, ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const count = (db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?").get(gid)?.c ?? 0) + 1;
  const channelName = `ticket-${String(count).padStart(4, "0")}-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const staffRole = guild.roles.cache.get(settings.ticket_support_role);
  const category = guild.channels.cache.get(settings.ticket_category);

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

  db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id, subject, status) VALUES (?, ?, ?, ?, 'open')").run(gid, channel.id, interaction.user.id, value);

  const closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close_btn").setLabel("🔒 Fermer le ticket").setStyle(ButtonStyle.Danger)
  );

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(CATEGORY_NAMES[value] ?? value)
    .setDescription(`Bonjour <@${interaction.user.id}> ! 👋\n\nMerci d'avoir ouvert un ticket. Le staff va vous répondre dès que possible.\n\nDécrivez votre demande ci-dessous.`)
    .addFields(
      { name: "Ouvert par", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Catégorie", value: CATEGORY_NAMES[value] ?? value, inline: true }
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
