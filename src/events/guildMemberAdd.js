const { logMemberAdd } = require("../handlers/logger.js");
const { checkRaid } = require("../handlers/protection.js");
module.exports = { name: "guildMemberAdd", async execute(member) { await logMemberAdd(member); await checkRaid(member); } };
