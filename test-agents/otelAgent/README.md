# OTelAgent Sample (OpenTelemetry + Microsoft 365 Agents SDK)

This sample shows a simple Agent hosted as a Node.js web app instrumented end‑to‑end with OpenTelemetry (traces, metrics, and logs) and optionally exporting to Azure Monitor / Application Insights.  
It echoes user messages and demonstrates how to add custom Spans, counters, histograms, and enrichment for inbound and outbound HTTP operations.

The sample helps you:
- Understand the Microsoft 365 Agents SDK messaging loop.
- Learn how to integrate OpenTelemetry in an Agent (configuration, custom telemetry, enrichment).
- Use conditional HttpClient instrumentation and Azure Monitor export.

## Prerequisites

- [Node.js](https://nodejs.org/en) version 20 or higher
- [dev tunnel](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started?tabs=windows)
- (Optional) Azure Application Insights resource if you want to export telemetry.

## QuickestStart using Agent Toolkit
1. If you haven't done so already, install the Agents Playground
 
   ```
   winget install agentsplayground
   ```
1. Start the Agent in VS or VS Code in debug
1. Start Agents Playground.  At a command prompt: `agentsplayground`
   - The tool will open a web browser showing the Microsoft 365 Agents Playground, ready to send messages to your agent. 
1. Interact with the Agent via the browser

## QuickStart using WebChat or Teams

- Overview of running and testing an Agent
  - Provision an Azure Bot in your Azure Subscription
  - Configure your Agent settings to use to desired authentication type
  - Running an instance of the Agent app (either locally or deployed to Azure)
  - Test in a client

1. Create an Azure Bot with one of these authentication types
   - [SingleTenant, Client Secret](https://github.com/microsoft/Agents/blob/main/docs/HowTo/azurebot-create-single-secret.md)
   - [SingleTenant, Federated Credentials](https://github.com/microsoft/Agents/blob/main/docs/HowTo/azurebot-create-fic.md) 
   - [User Assigned Managed Identity](https://github.com/microsoft/Agents/blob/main/docs/HowTo/azurebot-create-msi.md)


1. Configuring the authentication connection in the Agent settings
   > These instructions are for **SingleTenant, Client Secret**. For other auth type configuration, see [Configure authentication in a JavaScript agent](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/azure-bot-authentication-for-javascript).
   1. Rename env.TEMPLATE as .env.

   1. Find the `connections` section,  it should appear similar to this:

      ```bash
      connections__serviceConnection__settings__clientId={{clientId}} # this is the Client ID used for the connection.
      connections__serviceConnection__settings__clientSecret={{clientSecret}} # this is the Client Secret used for the connection.
      connections__serviceConnection__settings__tenantId={{tenantId}} # this is the tenant ID for the application.
      ```


      1. Replace all **{{ClientId}}** with the AppId of the Azure Bot.
      1. Replace all **{{TenantId}}** with the Tenant Id where your application is registered.
      1. Set the **{{ClientSecret}}** to the Secret that was created on the App Registration.
      
      > Storing sensitive values in .env files is not recommend.  Follow 
      [Microsoft identity platform authentication](https://learn.microsoft.com/en-us/entra/identity-platform/authentication-vs-authorization) and [MSAL.js](https://learn.microsoft.com/azure/active-directory/develop/msal-overview) for best practices.
      1. If using Azure Monitor, set `APPLICATIONINSIGHTS_CONNECTION_STRING` To expose your local Agent:

1. Running the Agent
   1. Running the Agent locally
      - Requires a tunneling tool to allow for local development and debugging connected to a external client such as Microsoft Teams.
      - **For ClientSecret or Certificate authentication types only.**  Federated Credentials and Managed Identity will not work via a tunnel to a local agent and must be deployed to an App Service or container.
      
      1. Run `dev tunnels`. Please follow [Create and host a dev tunnel](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started?tabs=windows) and host the tunnel with anonymous user access command as shown below:

         ```bash
         devtunnel host -p 3978 --allow-anonymous
         ```

      1. On the Azure Bot, select **Settings**, then **Configuration**, and update the **Messaging endpoint** to `{tunnel-url}/api/messages`

      1. In the agent's root directory install dependencies by running `npm install`.
      1. Start the Agent by running `npm start`

## Testing this agent with WebChat

   1. Select **Test in WebChat** on the Azure Bot

## Testing this Agent in Teams or M365

1. Update the manifest.json
   - Edit the `manifest.json` contained in the `/appManifest` folder
     - Replace with your AppId (that was created above) *everywhere* you see the place holder string `<<AAD_APP_CLIENT_ID>>`
     - Replace `<<BOT_DOMAIN>>` with your Agent url.  For example, the tunnel host name.
   - Zip up the contents of the `/appManifest` folder to create a `manifest.zip`
     - `manifest.json`
     - `outline.png`
     - `color.png`

1. Your Azure Bot should have the **Microsoft Teams** channel added under **Channels**.

1. Navigate to the Microsoft Admin Portal (MAC). Under **Settings** and **Integrated Apps,** select **Upload Custom App**.

1. Select the `manifest.zip` created in the previous step. 

1. After a short period of time, the agent shows up in Microsoft Teams and Microsoft 365 Copilot.


## Further reading
To learn more about building Agents, see our [Microsoft 365 Agents SDK](https://github.com/microsoft/agents) repo.
