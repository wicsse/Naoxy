const { logRoleDelete } = require("../handlers/logger.js");
const { checkRoleDelete } = require("../handlers/antinuke.js");
module.exports = {
  name: "roleDelete",
  async execute(role) {
    await Promise.all([
      logRoleDelete(role),
      checkRoleDelete(role),
    ]);
  }
};
