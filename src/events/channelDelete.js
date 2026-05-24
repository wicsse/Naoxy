const { logChannelDelete } = require("../handlers/logger.js");
module.exports = { name: "channelDelete", async execute(channel) { await logChannelDelete(channel); } };
