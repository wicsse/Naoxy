const { db } = require("../database/db.js");

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    const rows = db.prepare("SELECT * FROM autoroles WHERE guild_id = ?").all(member.guild.id);
    for (const row of rows) {
      if (row.type === "bot" && !member.user.bot) continue;
      if (row.type === "human" && member.user.bot) continue;
      try { await member.roles.add(row.role_id); } catch {}
    }
  }
};
