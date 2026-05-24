const { logInviteDelete } = require("../handlers/logger.js");
module.exports = { name: "inviteDelete", async execute(invite) { await logInviteDelete(invite); } };
