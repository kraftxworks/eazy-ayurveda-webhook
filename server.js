const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.json());

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a warm, helpful customer support assistant for Eazy Ayurveda, an Ayurvedic wellness brand from India. Products:
1. Amla Candy - Vitamin C, immunity
2. Acidity Churan - relieves acidity
3. Triphala Churan - digestive health
4. Chyawanprash - immunity booster
5. Giloy Juice - fever relief
6. Ashwagandha Powder - stress relief
7. Neem Tulsi Juice - skin health
Reply in same language as customer (Hindi/English). Be warm, concise (2-4 sentences). Sign off: - Team Eazy Ayurveda 🌿`;

// Webhook verification (Meta requires this)
app.get("/webhook", (req, res) => {
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive DMs
app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately

  const body = req.body;
  if (body.object !== "instagram") return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const message = event.message?.text;
      if (!message || !senderId) continue;

      console.log(`📩 DM from ${senderId}: ${message}`);

      try {
        // Generate Claude reply
        const response = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: message }]
        });
        const reply = response.content[0].text;
        console.log(`🤖 Reply: ${reply.substring(0, 80)}...`);

        // Send reply via Meta Graph API
        await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${process.env.PAGE_ACCESS_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            message: { text: reply }
          })
        });
        console.log(`✅ Reply sent!`);
      } catch (e) {
        console.log(`❌ Error: ${e.message}`);
      }
    }
  }
});

app.get("/", (req, res) => res.send("🌿 Eazy Ayurveda Webhook Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌿 Server running on port ${PORT}`));
