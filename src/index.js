const express = require('express');
const path = require('path');
const dashboardRoutes = require('./dashboard/routes.js');
const { Client, GatewayIntentBits, Partials, Collection, REST, Routes } = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
});

client.commands = new Collection();
const slashCommandsData = [];
const commandsPath = path.join(__dirname, "commands");
for (const folder of fs.readdirSync(commandsPath)) {
  const folderPath = path.join(commandsPath, folder);
  try {
    for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith(".js"))) {
      const mod = require(path.join(folderPath, file));
      const cmds = Array.isArray(mod) ? mod : [mod];
      for (const cmd of cmds) {
        if (cmd?.data && cmd?.execute) {
          client.commands.set(cmd.data.name, cmd);
          slashCommandsData.push(cmd.data.toJSON());
        }
      }
    }
  } catch (e) { console.error(e); }
}

const eventsPath = path.join(__dirname, "events");
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"))) {
  const event = require(path.join(eventsPath, file));
  if (event?.name) {
    if (event.once) client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
  }
}

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
if (!TOKEN || !CLIENT_ID) { console.error("❌ DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis"); process.exit(1); }

client.once("ready", async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);
  await client.user.setPresence({ activities: [{ name: "Orbis BOT ・BEST", type: 4 }], status: "online" });

  const rest = new REST().setToken(TOKEN);
  try {
    console.log("📡 Enregistrement des slash commands en global...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommandsData });
    console.log(`✅ ${slashCommandsData.length} slash commands enregistrées globalement.`);
  } catch (e) { console.error(e); }
});


// ── Dashboard ──
const app = express();
app.use(express.json());
app.get("/", (req, res) => res.redirect("/login"));
app.use(express.static(path.join(__dirname, 'dashboard/public')));
app.use(dashboardRoutes(client, app));
const PORT = process.env.DASHBOARD_PORT || 3001;
app.listen(PORT, () => console.log('🌐 Dashboard sur http://localhost:' + PORT));

client.login(TOKEN);

