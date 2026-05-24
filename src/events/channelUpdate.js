const { logChannelUpdate } = require("../handlers/logger.js");
module.exports = { name: "channelUpdate", async execute(o, n) { await logChannelUpdate(o, n); } };
