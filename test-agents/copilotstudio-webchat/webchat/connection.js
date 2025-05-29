// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Observable } from "rxjs/Observable";
import { BehaviorSubject } from "rxjs/BehaviorSubject";
import axios from "axios";

export class Connection {
  #observer;
  #sequenceId = 0;
  #typingActivity = {
    type: "typing",
    from: { id: "bot", name: "Bot" },
  };

  conversation;

  //#region WebChat BotConnection interface
  connectionStatus$ = new BehaviorSubject(0);
  activity$ = Observable.create(this.#register.bind(this));

  postActivity(activity) {
    return Observable.create((observer) => {
      this.#sendActivity(activity)
        .then(({ id }) => observer.next(id))
        .catch((error) => observer.error(error));
    });
  }

  end() {
    this.connectionStatus$.complete();
    this.activity$.complete();
    if (this.#observer) {
      this.#observer.complete();
      this.#observer = null;
    }
  }
  //#endregion

  async #register(observer) {
    this.#observer = observer;

    if (this.connectionStatus$.value < 2) {
      this.connectionStatus$.next(2);
      return;
    }

    this.#notify(this.#typingActivity);
    this.conversation = await this.#createConversation();
    this.#sequenceId = 0;
    this.#notify(this.conversation.activity);
  }

  #notify(activity) {
    if (!activity) {
      return;
    }

    this.#observer.next({
      ...activity,
      channelData: {
        ...activity.channelData,
        "webchat:sequence-id": this.#sequenceId++,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async #createConversation() {
    const { data: conversation } = await axios.post(
      "copilotstudio/conversations"
    );

    return conversation;
  }

  async #sendActivity(activity) {
    const id = Math.random().toString(36).substring(2, 15); // TODO: Use a better ID generation method

    this.#notify({ ...activity, id });

    const {
      data: { activities },
    } = await axios.post(
      `/copilotstudio/conversations/${this.conversation.id}/activities`,
      {
        activity,
      }
    );

    this.#notify(this.#typingActivity);
    for (const reponse of activities) {
      this.#notify(reponse);
    }

    return { id };
  }
}
