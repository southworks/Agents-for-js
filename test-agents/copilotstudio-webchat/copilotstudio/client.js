// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
  loadCopilotStudioConnectionSettingsFromEnv,
  CopilotStudioClient,
} from "@microsoft/agents-copilotstudio-client";
import pkg from "@microsoft/agents-copilotstudio-client/package.json" with { type: "json" };
import { acquireToken } from "./auth.js";

function withTokenRefresh(createClient) {
  let client;
  return async refreshCallback => {
    try {
      client ??= await createClient();
      return await refreshCallback(client);
    } catch (error) {
      if(error.status === 401){
        client = await createClient();
        return await refreshCallback(client);
      }

      throw error;
    }
  }
}

export function createClient() {
  const settings = loadCopilotStudioConnectionSettingsFromEnv();
  console.log(
    `Copilot Studio Client Version: ${
      pkg.version
    }, running with settings: ${JSON.stringify(settings, null, 2)}`
  );

  const withClientTokenRefresh = withTokenRefresh(async () => {
    const token = await acquireToken(settings);
    return new CopilotStudioClient(settings, token);
  })

  return {
    startConversationAsync(emitStartConversationEvent = false){
      return withClientTokenRefresh((client) => client.startConversationAsync(emitStartConversationEvent));
    },

    askQuestionAsync(question, conversationId = ''){
      return withClientTokenRefresh((client) => client.askQuestionAsync(question,conversationId))
    }
  }
}