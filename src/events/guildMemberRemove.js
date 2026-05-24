const { logMemberRemove } = require("../handlers/logger.js");
module.exports = { name: "guildMemberRemove", async execute(member) { await logMemberRemove(member); } };
