const { Events, EmbedBuilder } = require("discord.js");
const { db } = require("../database/db.js");

// Liste des serveurs autorisés (ceux qui ont payé)
function isAuthorized(guildId) {
  const sub = db.prepare("SELECT * FROM premium_subscriptions WHERE guild_id = ? AND status = 'active' AND expires_at > unixepoch()").get(guildId);
  return !!sub;
}

module.exports = {
  name: Events.GuildCreate,
  async execute(guild) {
    // Vérifier si le serveur a payé
    if (!isAuthorized(guild.id)) {
      // Trouver un salon pour envoyer le message
      const channel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me)?.has("SendMessages"));
      
      if (channel) {
        await channel.send({ embeds: [new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle("❌ Accès refusé")
          .setDescription("Ce bot est **privé**. Pour l'ajouter sur votre serveur, vous devez acheter une licence.\n\n📩 Contactez **Naoxy** sur Discord pour obtenir l'accès.")
          .addFields({ name: "💰 Prix", value: "À partir de **4.99€/mois**" })
        ]}).catch(() => {});
      }
      
      // Quitter le serveur après 5 secondes
      setTimeout(() => guild.leave().catch(() => {}), 5000);
      console.log(`❌ Serveur non autorisé : ${guild.name} (${guild.id}) — bot parti`);
      return;
    }
    
    console.log(`✅ Nouveau serveur autorisé : ${guild.name} (${guild.id})`);
  }
};
