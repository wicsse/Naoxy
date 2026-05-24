const { logVoiceUpdate } = require("../handlers/logger.js");
module.exports = { name: "voiceStateUpdate", async execute(o, n) { await logVoiceUpdate(o, n); } };
