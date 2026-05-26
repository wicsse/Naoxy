const { checkMemberBan } = require("../handlers/antinuke.js");
module.exports = {
  name: "guildBanAdd",
  async execute(ban) {
    await checkMemberBan(ban.guild, ban.user);
  }
};
