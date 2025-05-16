/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Strategy } from "./strategy";

export interface PublishedBotStrategySettings {
  readonly host: URL;
  readonly schema: string;
}

export class PublishedBotStrategy implements Strategy {
  private readonly API_VERSION = "2022-03-01-preview";

  #baseURL: URL;

  constructor(settings: PublishedBotStrategySettings) {
    const { schema, host } = settings;

    this.#baseURL = new URL(
      `/copilotstudio/dataverse-backed/authenticated/bots/${schema}`,
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
