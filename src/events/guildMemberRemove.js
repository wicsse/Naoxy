const { logMemberRemove } = require("../handlers/logger.js");
const { checkMemberKick } = require("../handlers/antinuke.js");
module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    await Promise.all([
      logMemberRemove(member),
      checkMemberKick(member),
    ]);
  }
};
