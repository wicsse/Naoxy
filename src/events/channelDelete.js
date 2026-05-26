const { logChannelDelete } = require("../handlers/logger.js");
const { checkChannelDelete } = require("../handlers/antinuke.js");
module.exports = {
  name: "channelDelete",
  async execute(channel) {
    await Promise.all([
      logChannelDelete(channel),
      checkChannelDelete(channel),
    ]);
  }
};
