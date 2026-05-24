const { logChannelCreate } = require("../handlers/logger.js");
module.exports = { name: "channelCreate", async execute(channel) { await logChannelCreate(channel); } };
