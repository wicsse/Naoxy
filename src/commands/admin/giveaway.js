const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require("discord.js");
const { db } = require("../../database/db.js");
const { successEmbed, errorEmbed, infoEmbed, COLORS, parseDuration, formatDuration, randomInt } = require("../../utils/helpers.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Gérer les giveaways")
    .addSubcommand(s => s.setName("start").setDescription("Lancer un giveaway")
      .addStringOption(o => o.setName("lot").setDescription("Ce qui est à gagner").setRequired(true))
      .addStringOption(o => o.setName("duree").setDescription("Durée ex: 1h, 7d").setRequired(true))
      .addIntegerOption(o => o.setName("gagnants").setDescription("Nombre de gagnants").setMinValue(1).setMaxValue(20).setRequired(false))
      .addChannelOption(o => o.setName("salon").setDescription("Salon").setRequired(false)))
    .addSubcommand(s => s.setName("end").setDescription("Terminer un giveaway").addIntegerOption(o => o.setName("id").setDescription("ID du giveaway").setRequired(true)))
    .addSubcommand(s => s.setName("reroll").setDescription("Reroll un giveaway").addIntegerOption(o => o.setName("id").setDescription("ID du giveaway").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("Lister les giveaways actifs"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "start") {
      const prize = interaction.options.getString("lot", true);
      const dureeStr = interaction.options.getString("duree", true);
      const winners = interaction.options.getInteger("gagnants") ?? 1;
      const channel = interaction.options.getChannel("salon") ?? interaction.channel;
      const duration = parseDuration(dureeStr);
      if (!duration) return interaction.reply({ embeds: [errorEmbed("Format invalide. Ex: 1h, 7d")], ephemeral: true });
      const endsAt = Math.floor(Date.now() / 1000) + duration;

      const btn = new ButtonBuilder().setCustomId("giveaway_join").setLabel("🎉 Participer").setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder().addComponents(btn);

      const embed = new EmbedBuilder()
        .setColor(COLORS.gold)
        .setTitle("🎉 GIVEAWAY 🎉")
        .setDescription(`**${prize}**\n\nCliquez sur le bouton pour participer !\n\n**Fin :** <t:${endsAt}:R>\n**Gagnants :** ${winners}\n**Organisé par :** ${interaction.user}`)
        .setTimestamp(endsAt * 1000);

      const msg = await channel.send({ embeds: [embed], components: [row] });
      const result = db.prepare("INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners_count, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(gid, channel.id, msg.id, interaction.user.id, prize, winners, endsAt);
      await interaction.reply({ embeds: [successEmbed("Giveaway lancé !", `ID: **${result.lastInsertRowid}** — Se termine <t:${endsAt}:R>`)], ephemeral: true });

    } else if (sub === "end") {
      const id = interaction.options.getInteger("id", true);
      const gaw = db.prepare("SELECT * FROM giveaways WHERE id = ? AND guild_id = ? AND ended = 0").get(id, gid);
      if (!gaw) return interaction.reply({ embeds: [errorEmbed("Giveaway introuvable ou déjà terminé.")], ephemeral: true });
      await endGiveaway(gaw, interaction.client);
      await interaction.reply({ embeds: [successEmbed("Giveaway terminé !")], ephemeral: true });

    } else if (sub === "reroll") {
      const id = interaction.options.getInteger("id", true);
      const gaw = db.prepare("SELECT * FROM giveaways WHERE id = ? AND guild_id = ?").get(id, gid);
      if (!gaw) return interaction.reply({ embeds: [errorEmbed("Giveaway introuvable.")], ephemeral: true });
      const entries = JSON.parse(gaw.entries);
      if (entries.length === 0) return interaction.reply({ embeds: [infoEmbed("Aucun participant.")] });
      const winner = entries[randomInt(0, entries.length - 1)];
      const channel = interaction.guild.channels.cache.get(gaw.channel_id);
      await channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle("🎉 Reroll !").setDescription(`Nouveau gagnant : <@${winner}> pour **${gaw.prize}** !`)] });
      await interaction.reply({ embeds: [successEmbed("Reroll effectué !")], ephemeral: true });

    } else if (sub === "list") {
      const rows = db.prepare("SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC").all(gid);
      if (rows.length === 0) return interaction.reply({ embeds: [infoEmbed("Aucun giveaway actif.")] });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle("🎉 Giveaways actifs").setDescription(rows.map(g => `**#${g.id}** — **${g.prize}** (<t:${g.ends_at}:R>) — ${g.winners_count} gagnant(s)`).join("\n"))] });
    }
  }
};

async function endGiveaway(gaw, client) {
  db.prepare("UPDATE giveaways SET ended = 1 WHERE id = ?").run(gaw.id);
  const entries = JSON.parse(gaw.entries);
  const guild = client.guilds.cache.get(gaw.guild_id);
  const channel = guild?.channels.cache.get(gaw.channel_id);
  if (!channel) return;

  if (entries.length === 0) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.error).setTitle("🎉 Giveaway terminé").setDescription(`Aucun participant pour **${gaw.prize}** 😔`)] });
    return;
  }

  const shuffled = entries.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(gaw.winners_count, shuffled.length));
  await channel.send({ content: winners.map(w => `<@${w}>`).join(" "), embeds: [new EmbedBuilder().setColor(COLORS.gold).setTitle("🎉 Giveaway terminé !").setDescription(`Gagnant(s) : ${winners.map(w => `<@${w}>`).join(", ")}\n\n**Prix : ${gaw.prize}**`)] });
}

module.exports.endGiveaway = endGiveaway;
