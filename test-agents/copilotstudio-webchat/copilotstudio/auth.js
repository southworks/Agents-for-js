// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as msal from "@azure/msal-node";
import open from "open";

export async function acquireToken(settings) {
  const pca = new msal.PublicClientApplication({
    auth: {
      clientId: settings.appClientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId}`,
    },
  });
  const tokenRequest = {
    scopes: ["https://api.powerplatform.com/.default"],
    redirectUri: "http://localhost",
    openBrowser: (url) => open(url),
  };

  try {
    const accounts = await pca.getAllAccounts();
    if (accounts.length > 0) {
      const response = await pca.acquireTokenSilent({
        account: accounts[0],
        scopes: tokenRequest.scopes,
      });
      return response.accessToken;
    } else {
      const response = await pca.acquireTokenInteractive(tokenRequest);
      return response.accessToken;
    }
  } catch (error) {
    console.error("Error acquiring token interactively:", error);
    const response = await pca.acquireTokenInteractive(tokenRequest);
    return response.accessToken;
  }
}
