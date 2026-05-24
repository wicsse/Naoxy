const { logMessageDelete } = require("../handlers/logger.js");
module.exports = { name: "messageDelete", async execute(message) { await logMessageDelete(message); } };
