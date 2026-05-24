const { logInviteCreate } = require("../handlers/logger.js");
module.exports = { name: "inviteCreate", async execute(invite) { await logInviteCreate(invite); } };
