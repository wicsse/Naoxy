const { REST, Routes } = require("discord.js");
require("dotenv").config();

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, "1229533200989032528"), { body: [] });
  console.log("✅ Commandes du serveur supprimées");
})();
