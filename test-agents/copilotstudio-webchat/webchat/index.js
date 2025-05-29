// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import "./index.css";

import { renderWebChat } from "botframework-webchat";
import { Connection } from "./connection.js";

renderWebChat(
  {
    directLine: new Connection(),
    locale: "en-US",
  },
  document.getElementById("webchat")
);

document.querySelector("#webchat > *")?.focus();
