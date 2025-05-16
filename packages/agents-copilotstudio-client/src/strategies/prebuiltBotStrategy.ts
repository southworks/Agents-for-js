/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Strategy } from "./strategy";

export interface PrebuiltBotStrategySettings {
  readonly host: URL;
  readonly identifier: string;
}

export class PrebuiltBotStrategy implements Strategy {
  private readonly API_VERSION = "2022-03-01-preview";

  #baseURL: URL;

  constructor(settings: PrebuiltBotStrategySettings) {
    const { identifier, host } = settings;

    this.#baseURL = new URL(
      `/copilotstudio/prebuilt/authenticated/bots/${identifier}`,
      host
    );
    this.#baseURL.searchParams.append("api-version", this.API_VERSION);
  }

  public getConversationUrl(conversationId?: string): string {
    this.#baseURL.pathname = `${this.#baseURL.pathname}/conversations`;

    if (conversationId) {
       this.#baseURL.pathname = `${this.#baseURL.pathname}/${conversationId}`;
    }

    return this.#baseURL.href;
  }
}
