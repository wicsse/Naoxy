const { EmbedBuilder, AuditLogEvent } = require("discord.js");
const { db } = require("../database/db.js");

function getLogChannels(guildId) {
  const row = db.prepare("SELECT * FROM guild_settings WHERE guild_id = ?").get(guildId);
  return {
    messages:   row?.log_messages_channel,
    membres:    row?.log_membres_channel,
    moderation: row?.log_moderation_channel,
    serveur:    row?.log_serveur_channel,
  };
}

function send(guild, channelId, embed) {
  if (!channelId) return;
  const ch = guild.channels.cache.get(channelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────
async function logMessageDelete(message) {
  if (!message.guild || !message.author || message.author?.bot) return;
  const { messages } = getLogChannels(message.guild.id);
  send(message.guild, messages, new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle("🗑️ Message supprimé")
    .setThumbnail(message.author.displayAvatarURL())
    .addFields(
      { name: "Auteur", value: `${message.author} (\`${message.author.id}\`)`, inline: true },
      { name: "Salon", value: `${message.channel}`, inline: true },
      { name: "Contenu", value: message.content?.slice(0, 1024) || "*Aucun contenu texte*" },
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${message.id}` }));
}

async function logMessageUpdate(oldMessage, newMessage) {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;
  const { messages } = getLogChannels(oldMessage.guild.id);
  send(oldMessage.guild, messages, new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle("✏️ Message modifié")
    .setThumbnail(oldMessage.author?.displayAvatarURL() ?? null)
    .setURL(newMessage.url)
    .addFields(
      { name: "Auteur", value: `${oldMessage.author} (\`${oldMessage.author.id}\`)`, inline: true },
      { name: "Salon", value: `${oldMessage.channel}`, inline: true },
      { name: "Avant", value: oldMessage.content?.slice(0, 512) || "*vide*" },
      { name: "Après", value: newMessage.content?.slice(0, 512) || "*vide*" },
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${oldMessage.id}` }));
}

// ─── MEMBRES ─────────────────────────────────────────────────────────────────
async function logMemberAdd(member) {
  const { membres } = getLogChannels(member.guild.id);
  const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  send(member.guild, membres, new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle("📥 Membre rejoint")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "Membre", value: `${member.user} (\`${member.user.id}\`)`, inline: true },
      { name: "Compte créé", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Âge du compte", value: `${accountAge} jours`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `Membres: ${member.guild.memberCount}` }));
}

async function logMemberRemove(member) {
  const { membres } = getLogChannels(member.guild.id);
  const roles = member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `${r}`).join(", ") || "Aucun";
  send(member.guild, membres, new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle("📤 Membre parti")
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "Membre", value: `${member.user} (\`${member.user.id}\`)`, inline: true },
      { name: "A rejoint", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: "Rôles", value: roles.slice(0, 512) },
    )
    .setTimestamp()
    .setFooter({ text: `Membres: ${member.guild.memberCount}` }));
}

async function logMemberUpdate(oldMember, newMember) {
  const { membres } = getLogChannels(newMember.guild.id);

  // Rôles ajoutés/retirés
  const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

  if (addedRoles.size > 0 || removedRoles.size > 0) {
    const { serveur } = getLogChannels(newMember.guild.id);
    send(newMember.guild, serveur, new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🎭 Rôles mis à jour")
      .setThumbnail(newMember.user.displayAvatarURL())
      .addFields(
        { name: "Membre", value: `${newMember.user} (\`${newMember.user.id}\`)`, inline: true },
        ...(addedRoles.size > 0 ? [{ name: "✅ Ajoutés", value: addedRoles.map(r => `${r}`).join(", "), inline: true }] : []),
        ...(removedRoles.size > 0 ? [{ name: "❌ Retirés", value: removedRoles.map(r => `${r}`).join(", "), inline: true }] : []),
      )
      .setTimestamp());
  }

  // Pseudo changé
  if (oldMember.nickname !== newMember.nickname) {
    send(newMember.guild, membres, new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle("📝 Pseudo modifié")
      .addFields(
        { name: "Membre", value: `${newMember.user} (\`${newMember.user.id}\`)`, inline: true },
        { name: "Avant", value: oldMember.nickname || "*Aucun*", inline: true },
        { name: "Après", value: newMember.nickname || "*Aucun*", inline: true },
      )
      .setTimestamp());
  }
}

// ─── SALONS ──────────────────────────────────────────────────────────────────
async function logChannelCreate(channel) {
  if (!channel.guild) return;
  const { serveur } = getLogChannels(channel.guild.id);
  send(channel.guild, serveur, new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle("📁 Salon créé")
    .addFields(
      { name: "Salon", value: `${channel} (\`${channel.name}\`)`, inline: true },
      { name: "Type", value: `\`${channel.type}\``, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${channel.id}` }));
}

async function logChannelDelete(channel) {
  if (!channel.guild) return;
  const { serveur } = getLogChannels(channel.guild.id);
  send(channel.guild, serveur, new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle("🗑️ Salon supprimé")
    .addFields(
      { name: "Nom", value: `\`${channel.name}\``, inline: true },
      { name: "Type", value: `\`${channel.type}\``, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${channel.id}` }));
}

async function logChannelUpdate(oldChannel, newChannel) {
  if (!oldChannel.guild) return;
  if (oldChannel.name === newChannel.name && oldChannel.topic === newChannel.topic) return;
  const { serveur } = getLogChannels(oldChannel.guild.id);
  send(oldChannel.guild, serveur, new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle("✏️ Salon modifié")
    .addFields(
      { name: "Salon", value: `${newChannel}`, inline: true },
      ...(oldChannel.name !== newChannel.name ? [{ name: "Nom", value: `\`${oldChannel.name}\` → \`${newChannel.name}\``, inline: true }] : []),
      ...(oldChannel.topic !== newChannel.topic ? [{ name: "Topic", value: `${oldChannel.topic || "*vide*"} → ${newChannel.topic || "*vide*"}` }] : []),
    )
    .setTimestamp());
}

// ─── RÔLES ───────────────────────────────────────────────────────────────────
async function logRoleCreate(role) {
  const { serveur } = getLogChannels(role.guild.id);
  send(role.guild, serveur, new EmbedBuilder()
    .setColor(role.color || 0x00FF88)
    .setTitle("✅ Rôle créé")
    .addFields(
      { name: "Rôle", value: `${role} (\`${role.name}\`)`, inline: true },
      { name: "Couleur", value: role.hexColor, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${role.id}` }));
}

async function logRoleDelete(role) {
  const { serveur } = getLogChannels(role.guild.id);
  send(role.guild, serveur, new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle("❌ Rôle supprimé")
    .addFields(
      { name: "Nom", value: `\`${role.name}\``, inline: true },
      { name: "Couleur", value: role.hexColor, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `ID: ${role.id}` }));
}

// ─── VOCAUX ──────────────────────────────────────────────────────────────────
async function logVoiceUpdate(oldState, newState) {
  const { serveur } = getLogChannels(newState.guild.id);
  const member = newState.member;

  if (!oldState.channel && newState.channel) {
    send(newState.guild, serveur, new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle("🎙️ Vocal — Rejoint")
      .addFields(
        { name: "Membre", value: `${member.user} (\`${member.user.id}\`)`, inline: true },
        { name: "Salon", value: `\`${newState.channel.name}\``, inline: true },
      )
      .setTimestamp());
  } else if (oldState.channel && !newState.channel) {
    send(newState.guild, serveur, new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle("🎙️ Vocal — Quitté")
      .addFields(
        { name: "Membre", value: `${member.user} (\`${member.user.id}\`)`, inline: true },
        { name: "Salon", value: `\`${oldState.channel.name}\``, inline: true },
      )
      .setTimestamp());
  } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    send(newState.guild, serveur, new EmbedBuilder()
      .setColor(0xFFAA00)
      .setTitle("🎙️ Vocal — Changé")
      .addFields(
        { name: "Membre", value: `${member.user} (\`${member.user.id}\`)`, inline: true },
        { name: "Avant", value: `\`${oldState.channel.name}\``, inline: true },
        { name: "Après", value: `\`${newState.channel.name}\``, inline: true },
      )
      .setTimestamp());
  }
}

// ─── INVITATIONS ─────────────────────────────────────────────────────────────
async function logInviteCreate(invite) {
  const { serveur } = getLogChannels(invite.guild.id);
  send(invite.guild, serveur, new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle("🔗 Invitation créée")
    .addFields(
      { name: "Code", value: `\`${invite.code}\``, inline: true },
      { name: "Créée par", value: `${invite.inviter}`, inline: true },
      { name: "Salon", value: `${invite.channel}`, inline: true },
      { name: "Expire", value: invite.expiresAt ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : "Jamais", inline: true },
      { name: "Utilisations max", value: `${invite.maxUses || "∞"}`, inline: true },
    )
    .setTimestamp());
}

async function logInviteDelete(invite) {
  const { serveur } = getLogChannels(invite.guild.id);
  send(invite.guild, serveur, new EmbedBuilder()
    .setColor(0xFF4444)
    .setTitle("🔗 Invitation supprimée")
    .addFields(
      { name: "Code", value: `\`${invite.code}\``, inline: true },
      { name: "Salon", value: `${invite.channel}`, inline: true },
    )
    .setTimestamp());
}

module.exports = {
  logMessageDelete, logMessageUpdate,
  logMemberAdd, logMemberRemove, logMemberUpdate,
  logChannelCreate, logChannelDelete, logChannelUpdate,
  logRoleCreate, logRoleDelete,
  logVoiceUpdate,
  logInviteCreate, logInviteDelete,
};
