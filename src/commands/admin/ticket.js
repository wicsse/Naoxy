const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits, COLORS
} = require("discord.js");
const { db } = require("../../database/db.js");
const { successEmbed, errorEmbed } = require("../../utils/helpers.js");

const CATEGORIES = [
  { label: "🎧 Support général", description: "Une question ou un problème général", value: "support", emoji: "🎧" },
  { label: "🛒 Commande / Achat", description: "Concernant une commande ou un achat", value: "commande", emoji: "🛒" },
  { label: "📩 Autre", description: "Toute autre demande", value: "autre", emoji: "📩" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Système de tickets")
    .addSubcommand(s => s.setName("panel").setDescription("Envoyer le panel de tickets")
      .addChannelOption(o => o.setName("salon").setDescription("Salon où envoyer le panel").setRequired(false))
      .addStringOption(o => o.setName("titre").setDescription("Titre du panel").setRequired(false))
      .addStringOption(o => o.setName("description").setDescription("Description du panel").setRequired(false)))
    .addSubcommand(s => s.setName("setup").setDescription("Configurer les tickets")
      .addChannelOption(o => o.setName("categorie").setDescription("Catégorie Discord pour les tickets").setRequired(true))
      .addRoleOption(o => o.setName("staff").setDescription("Rôle du staff").setRequired(true))
      .addChannelOption(o => o.setName("logs").setDescription("Salon de logs").setRequired(false)))
    .addSubcommand(s => s.setName("close").setDescription("Fermer le ticket actuel"))
    .addSubcommand(s => s.setName("add").setDescription("Ajouter un membre au ticket")
      .addUserOption(o => o.setName("membre").setDescription("Membre à ajouter").setRequired(true)))
    .addSubcommand(s => s.setName("remove").setDescription("Retirer un membre du ticket")
      .addUserOption(o => o.setName("membre").setDescription("Membre à retirer").setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "setup") {
      const categorie = interaction.options.getChannel("categorie");
      const staff = interaction.options.getRole("staff");
      const logs = interaction.options.getChannel("logs");

      if (categorie.type !== ChannelType.GuildCategory)
        return interaction.reply({ embeds: [errorEmbed("Veuillez choisir une **catégorie** Discord.")], ephemeral: true });

      const existing = db.prepare("SELECT guild_id FROM guild_settings WHERE guild_id = ?").get(gid);
      if (existing) {
        db.prepare("UPDATE guild_settings SET ticket_category_id = ?, ticket_staff_role = ?, ticket_log_channel = ? WHERE guild_id = ?")
          .run(categorie.id, staff.id, logs?.id ?? null, gid);
      } else {
        db.prepare("INSERT INTO guild_settings (guild_id, ticket_category_id, ticket_staff_role, ticket_log_channel) VALUES (?, ?, ?, ?)")
          .run(gid, categorie.id, staff.id, logs?.id ?? null);
      }

      await interaction.reply({ embeds: [successEmbed("✅ Tickets configurés !", `Catégorie : ${categorie}\nStaff : ${staff}\nLogs : ${logs ?? "Non défini"}`)], ephemeral: true });

    } else if (sub === "panel") {
      const salon = interaction.options.getChannel("salon") ?? interaction.channel;
      const titre = interaction.options.getString("titre") ?? "🎫 Support — Ouvrir un ticket";
      const desc = interaction.options.getString("description") ?? "📩 Sélectionnez une catégorie dans le menu ci-dessous pour ouvrir un ticket.\n\nMerci d'être respectueux et de ne pas ping les staffs sous peine de voir votre ticket fermé !";

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_open")
        .setPlaceholder("Fais un choix")
        .addOptions(CATEGORIES.map(c => ({ label: c.label, description: c.description, value: c.value, emoji: c.emoji })));

      const row = new ActionRowBuilder().addComponents(menu);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(titre)
        .setDescription(desc)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

      await salon.send({ embeds: [embed], components: [row] });
      await interaction.reply({ embeds: [successEmbed("✅ Panel envoyé !", `Panel envoyé dans ${salon}`)], ephemeral: true });

    } else if (sub === "close") {
      const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND closed = 0").get(interaction.channelId);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ce salon n'est pas un ticket ouvert.")], ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_confirm_close").setLabel("✅ Confirmer la fermeture").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_cancel_close").setLabel("❌ Annuler").setStyle(ButtonStyle.Secondary),
      );
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xFF4444).setDescription("Êtes-vous sûr de vouloir fermer ce ticket ?")], components: [row] });

    } else if (sub === "add") {
      const membre = interaction.options.getMember("membre");
      const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND closed = 0").get(interaction.channelId);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ce salon n'est pas un ticket.")], ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(membre, { ViewChannel: true, SendMessages: true });
      await interaction.reply({ embeds: [successEmbed(`✅ ${membre} ajouté au ticket !`)] });

    } else if (sub === "remove") {
      const membre = interaction.options.getMember("membre");
      const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND closed = 0").get(interaction.channelId);
      if (!ticket) return interaction.reply({ embeds: [errorEmbed("Ce salon n'est pas un ticket.")], ephemeral: true });
      await interaction.channel.permissionOverwrites.edit(membre, { ViewChannel: false, SendMessages: false });
      await interaction.reply({ embeds: [successEmbed(`✅ ${membre} retiré du ticket !`)] });
    }
  }
};
