// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import express from "express";
import cors from "cors";
import ViteExpress from "vite-express";

import { createClient } from "./client.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const copilotClient = createClient();

// Initialize routes
app.post("/copilotstudio/conversations", async (_, res) => {
  const activity = await copilotClient.startConversationAsync(true);
  res.json({ id: activity.conversation?.id, activity });
});

app.post(
  "/copilotstudio/conversations/:conversationId/activities",
  async (req, res) => {
    const { conversationId } = req.params;
    const { activity } = req.body;
    const activities = await copilotClient.askQuestionAsync(
      activity.text,
      conversationId
    );
    res.json({ activities });
  }
);

ViteExpress.config({
  inlineViteConfig: { root: "webchat" },
  mode: process.env.NODE_ENV === "production" ? "production" : "development",
});
ViteExpress.listen(app, PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
