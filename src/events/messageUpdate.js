const { logMessageUpdate } = require("../handlers/logger.js");
module.exports = { name: "messageUpdate", async execute(o, n) { await logMessageUpdate(o, n); } };
