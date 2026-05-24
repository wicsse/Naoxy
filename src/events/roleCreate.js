const { logRoleCreate } = require("../handlers/logger.js");
module.exports = { name: "roleCreate", async execute(role) { await logRoleCreate(role); } };
