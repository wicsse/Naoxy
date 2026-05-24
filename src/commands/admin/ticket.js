const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

const { db } = require("../../database/db.js");
const { successEmbed, errorEmbed } = require("../../utils/helpers.js");

const CATEGORIES = [
  {
    label: "🎧 Support général",
    description: "Une question ou un problème général",
    value: "support",
    emoji: "🎧"
  },
  {
    label: "🛒 Commande / Achat",
    description: "Concernant une commande ou un achat",
    value: "commande",
    emoji: "🛒"
  },
  {
    label: "📩 Autre",
    description: "Toute autre demande",
    value: "autre",
    emoji: "📩"
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Système de tickets")

    .addSubcommand(s =>
      s.setName("panel")
        .setDescription("Créer un panel de tickets")

        .addChannelOption(o =>
          o.setName("salon")
            .setDescription("Salon où envoyer le panel")
            .setRequired(true)
        )

        .addChannelOption(o =>
          o.setName("categorie")
            .setDescription("Catégorie où les tickets seront créés")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )

        .addRoleOption(o =>
          o.setName("staff")
            .setDescription("Rôle staff des tickets")
            .setRequired(true)
        )

        .addStringOption(o =>
          o.setName("nom")
            .setDescription("Nom des tickets ex: ticket-{user}")
            .setRequired(false)
        )

        .addStringOption(o =>
          o.setName("titre")
            .setDescription("Titre du panel")
            .setRequired(false)
        )

        .addStringOption(o =>
          o.setName("description")
            .setDescription("Description du panel")
            .setRequired(false)
        )
    )

    .addSubcommand(s =>
      s.setName("close")
        .setDescription("Fermer le ticket")
    )

    .addSubcommand(s =>
      s.setName("add")
        .setDescription("Ajouter un membre")
        .addUserOption(o =>
          o.setName("membre")
            .setDescription("Membre")
            .setRequired(true)
        )
    )

    .addSubcommand(s =>
      s.setName("remove")
        .setDescription("Retirer un membre")
        .addUserOption(o =>
          o.setName("membre")
            .setDescription("Membre")
            .setRequired(true)
        )
    )

    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {

    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "panel") {

      const salon = interaction.options.getChannel("salon");
      const categorie = interaction.options.getChannel("categorie");
      const staff = interaction.options.getRole("staff");

      const nomTicket =
        interaction.options.getString("nom") ||
        "ticket-{user}";

      const titre =
        interaction.options.getString("titre") ||
        "🎫 Ouvrir un ticket";

      const description =
        interaction.options.getString("description") ||
        "Sélectionnez une catégorie pour ouvrir un ticket.";

      const existing = db.prepare(`
        SELECT guild_id
        FROM guild_settings
        WHERE guild_id = ?
      `).get(gid);

      if (existing) {

        db.prepare(`
          UPDATE guild_settings
          SET
            ticket_category = ?,
            ticket_support_role = ?,
            ticket_name = ?
          WHERE guild_id = ?
        `).run(
          categorie.id,
          staff.id,
          nomTicket,
          gid
        );

      } else {

        db.prepare(`
          INSERT INTO guild_settings
          (
            guild_id,
            ticket_category,
            ticket_support_role,
            ticket_name
          )
          VALUES (?, ?, ?, ?)
        `).run(
          gid,
          categorie.id,
          staff.id,
          nomTicket
        );
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_open")
        .setPlaceholder("Choisis une catégorie")
        .addOptions(
          CATEGORIES.map(c => ({
            label: c.label,
            description: c.description,
            value: c.value,
            emoji: c.emoji
          }))
        );

      const row = new ActionRowBuilder()
        .addComponents(menu);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(titre)
        .setDescription(description)
        .setFooter({
          text: interaction.guild.name,
          iconURL: interaction.guild.iconURL()
        });

      await salon.send({
        embeds: [embed],
        components: [row]
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            "✅ Panel créé",
            `Salon : ${salon}
Catégorie : ${categorie}
Staff : ${staff}
Nom ticket : \`${nomTicket}\``
          )
        ],
        ephemeral: true
      });

    }

    else if (sub === "close") {

      const ticket = db.prepare(`
        SELECT *
        FROM tickets
        WHERE channel_id = ?
      `).get(interaction.channelId);

      if (!ticket) {
        return interaction.reply({
          embeds: [errorEmbed("Ce salon n'est pas un ticket.")],
          ephemeral: true
        });
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            "🔒 Ticket fermé",
            "Le salon sera supprimé dans 5 secondes."
          )
        ]
      });

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);

    }

    else if (sub === "add") {

      const membre = interaction.options.getMember("membre");

      await interaction.channel.permissionOverwrites.edit(
        membre,
        {
          ViewChannel: true,
          SendMessages: true
        }
      );

      await interaction.reply({
        embeds: [
          successEmbed(
            "✅ Membre ajouté",
            `${membre} a accès au ticket.`
          )
        ]
      });

    }

    else if (sub === "remove") {

      const membre = interaction.options.getMember("membre");

      await interaction.channel.permissionOverwrites.edit(
        membre,
        {
          ViewChannel: false
        }
      );

      await interaction.reply({
        embeds: [
          successEmbed(
            "✅ Membre retiré",
            `${membre} n'a plus accès au ticket.`
          )
        ]
      });

    }

  }
};