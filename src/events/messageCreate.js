const { Events, EmbedBuilder } = require("discord.js");
const { db, getMemberLevel, levelFromXp, xpForLevel, getGuildSettings } = require("../database/db.js");
const { COLORS } = require("../utils/helpers.js");

const aiMemoryMap = new Map();
function getAiHistory(channelId) {
  if (!aiMemoryMap.has(channelId)) aiMemoryMap.set(channelId, []);
  return aiMemoryMap.get(channelId);
}
function addToHistory(channelId, role, content) {
  const history = getAiHistory(channelId);
  history.push({ role, content });
  if (history.length > 20) history.splice(0, history.length - 20);
}
function buildSystemPrompt(settings, guild, botUser) {
  const persona = settings.ai_persona || "Orbis";
  const customPrompt = settings.ai_prompt || "";
  return `Tu es ${persona}, un bot Discord créé par le owner du serveur "${guild.name}".
Tu t'appelles ${persona}. Tu es unique et tu n'es pas un bot générique.
Ce serveur s'appelle "${guild.name}" et compte ${guild.memberCount} membres.

Commandes disponibles :
🛡️ Modération : /ban, /kick, /mute, /warn, /clear, /logs
🎫 Tickets : /ticket create, /ticket close, /ticket add
💰 Économie : /balance, /daily, /pay, /shop, /leaderboard
📈 Niveaux : /rank, /leaderboard, /setxp
🎉 Giveaways : /giveaway start, /giveaway end, /giveaway reroll
💾 Backup : /backup create, /backup load, /backup list, /backup delete, /backup info
🎭 Rôles : /roles autorole add, /roles reactionrole create, /roles give, /roles take, /roles all

RÈGLES ABSOLUES :
- TOUJOURS répondre en français. Jamais en anglais. Même si le modèle veut écrire en anglais, tu écris en français.
- Être naturel, amical et conversationnel. Pas robotique.
- Ne jamais prétendre être un humain.
- Ne jamais inventer d'informations (météo, actualités, etc.) que tu n'as pas.
- Pour mentionner l'utilisateur, utilise son mention Discord (fourni dans le message).
${customPrompt ? `\nInstructions supplémentaires :\n${customPrompt}` : ""}`;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guildId) return;
    const gid = message.guildId, uid = message.author.id;
    const settings = getGuildSettings(gid);
    const now = Math.floor(Date.now() / 1000);

    if (settings.levels_enabled) {
      const data = getMemberLevel(gid, uid);
      if (now - data.last_xp >= 60) {
        const xpGain = Math.floor(Math.random() * 15) + 10;
        const oldLevel = levelFromXp(data.xp);
        const newLevel = levelFromXp(data.xp + xpGain);
        db.prepare("UPDATE member_levels SET xp = xp + ?, messages = messages + 1, last_xp = ? WHERE guild_id = ? AND user_id = ?").run(xpGain, now, gid, uid);
        if (newLevel > oldLevel) {
          const msg = (settings.levels_message ?? "{user} vient de passer au niveau **{level}** !").replace("{user}", message.author.toString()).replace("{level}", `${newLevel}`).replace("{guild}", message.guild?.name ?? "");
          const ch = settings.levels_channel ? message.guild?.channels.cache.get(settings.levels_channel) : message.channel;
          if (ch) await ch.send({ embeds: [new EmbedBuilder().setColor(COLORS.gold).setDescription(`🎉 ${msg}`).setThumbnail(message.author.displayAvatarURL())] });
        }
      }
    }

    const prefix = settings.prefix ?? "!";
    if (message.content.startsWith(prefix)) {
      const cmdName = message.content.slice(prefix.length).split(" ")[0].toLowerCase();
      const cmd = db.prepare("SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?").get(gid, cmdName);
      if (cmd) await message.channel.send(cmd.response.replace("{user}", message.author.toString()));
    }

    if (settings.automod_enabled) {
      const content = message.content.toLowerCase();
      if (settings.automod_badwords) {
        const badwords = JSON.parse(settings.automod_badwords);
        if (badwords.some(w => content.includes(w))) {
          await message.delete().catch(() => {});
          const m = await message.channel.send({ content: `${message.author}, ce message a été supprimé. ⚠️` });
          setTimeout(() => m.delete().catch(() => {}), 5000);
          return;
        }
      }
      if (settings.automod_anti_link && /(https?:\/\/|discord\.gg\/)/i.test(message.content)) {
        await message.delete().catch(() => {});
        const m = await message.channel.send({ content: `${message.author}, les liens ne sont pas autorisés. ⚠️` });
        setTimeout(() => m.delete().catch(() => {}), 5000);
        return;
      }
    }

    const countingGame = db.prepare("SELECT * FROM counting WHERE guild_id = ?").get(gid);
    if (countingGame?.channel_id === message.channelId) {
      const num = parseInt(message.content.trim());
      if (isNaN(num) || num !== countingGame.current_number + 1) {
        await message.react("❌").catch(() => {});
        if (!isNaN(num)) {
          await message.channel.send({ embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${message.author} a cassé la séquence ! Recommencez depuis **1** !`)] });
          db.prepare("UPDATE counting SET current_number = 0, last_user_id = NULL WHERE guild_id = ?").run(gid);
        }
      } else if (countingGame.last_user_id === uid) {
        await message.react("⚠️").catch(() => {});
      } else {
        await message.react("✅").catch(() => {});
        db.prepare("UPDATE counting SET current_number = ?, last_user_id = ?, record = MAX(record, ?) WHERE guild_id = ?").run(num, uid, num, gid);
      }
    }

    if (settings.ai_enabled && message.mentions.has(message.client.user)) {
      if (settings.ai_channel && settings.ai_channel !== message.channelId) return;
      const userMsg = message.content.replace(/<@!?\d+>/g, "").trim();
      if (!userMsg) {
        await message.reply(`Bonjour ${message.author} ! Comment puis-je t'aider ? 😊`);
        return;
      }
      const key = process.env.GROQ_API_KEY;
      if (!key) return;
      try {
        await message.channel.sendTyping();
        const axios = require("axios");
        const systemPrompt = buildSystemPrompt(settings, message.guild, message.client.user);
        const history = getAiHistory(message.channelId);
        addToHistory(message.channelId, "user", `${message.author} dit : ${userMsg}`);
        const r = await axios.post(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            model: settings.ai_model || "llama-3.3-70b-versatile",
            max_tokens: parseInt(settings.ai_max_tokens) || 500,
            messages: [{ role: "system", content: systemPrompt }, ...history]
          },
          { headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" } }
        );
        const reply = r.data.choices[0].message.content;
        addToHistory(message.channelId, "assistant", reply);
        if (reply.length > 1990) {
          const chunks = reply.match(/.{1,1990}/gs);
          await message.reply(chunks[0]);
          for (let i = 1; i < chunks.length; i++) await message.channel.send(chunks[i]);
        } else {
          await message.reply(reply);
        }
      } catch (e) {
        console.error("[IA]", e.response?.data?.error?.message || e.message);
        await message.reply("❌ Une erreur s'est produite avec l'IA. Réessaie dans un moment.");
      }
    }
  },
};
