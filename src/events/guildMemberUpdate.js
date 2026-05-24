const { logMemberUpdate } = require("../handlers/logger.js");
module.exports = { name: "guildMemberUpdate", async execute(o, n) { await logMemberUpdate(o, n); } };
