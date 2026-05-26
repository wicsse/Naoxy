const axios = require("axios");

const BASE = "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const res = await axios.post(`${BASE}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      auth: { username: process.env.PAYPAL_CLIENT_ID, password: process.env.PAYPAL_SECRET },
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    }
  );
  return res.data.access_token;
}

async function createOrder(plan, price, guildId, userId, type) {
  const token = await getAccessToken();
  const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3001";
  const res = await axios.post(`${BASE}/v2/checkout/orders`, {
    intent: "CAPTURE",
    purchase_units: [{
      amount: { currency_code: "EUR", value: price.toFixed(2) },
      description: `Orbis Premium — Plan ${plan}`
    }],
    application_context: {
      return_url: `${dashboardUrl}/premium/success?plan=${plan}&guildId=${guildId||""}&userId=${userId||""}&type=${type}`,
      cancel_url: `${dashboardUrl}/premium/cancel`,
      brand_name: "Orbis Bot",
      user_action: "PAY_NOW"
    }
  }, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  return res.data;
}

async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await axios.post(`${BASE}/v2/checkout/orders/${orderId}/capture`, {},
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return res.data;
}

module.exports = { createOrder, captureOrder };
