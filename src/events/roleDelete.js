const { logRoleDelete } = require("../handlers/logger.js");
module.exports = { name: "roleDelete", async execute(role) { await logRoleDelete(role); } };
