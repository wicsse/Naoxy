const { db } = require("../database/db.js");

const PLANS = {
  starter: { name: "Starter", price: 4.99, color: 0xcd7f32 },
  pro:     { name: "Pro",     price: 9.99, color: 0xffd700 },
  enterprise: { name: "Enterprise", price: 24.99, color: 0x00bfff }
};

function getGuildPremium(guildId) {
  return db.prepare("SELECT * FROM premium_subscriptions WHERE guild_id = ? AND type = 'guild' AND status = 'active' AND (expires_at IS NULL OR expires_at > unixepoch()) ORDER BY started_at DESC LIMIT 1").get(guildId) || null;
}

function getUserPremium(userId) {
  return db.prepare("SELECT * FROM premium_subscriptions WHERE user_id = ? AND type = 'user' AND status = 'active' AND (expires_at IS NULL OR expires_at > unixepoch()) ORDER BY started_at DESC LIMIT 1").get(userId) || null;
}

function isPremium(guildId, userId) {
  return !!(getGuildPremium(guildId) || getUserPremium(userId));
}

function activatePremium({ guildId, userId, plan, type, paypalOrderId, price }) {
  const expires = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 jours
  db.prepare(`
    INSERT INTO premium_subscriptions (guild_id, user_id, plan, type, status, paypal_order_id, price, expires_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(guildId || null, userId || null, plan, type, paypalOrderId || null, price, expires);
}

module.exports = { PLANS, getGuildPremium, getUserPremium, isPremium, activatePremium };
