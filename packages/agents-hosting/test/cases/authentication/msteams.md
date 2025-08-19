# Authentication Handler Test Scenarios for MsTeams

This document presents a comprehensive suite of test cases for authentication handlers. The scenarios cover login, logout, multi-provider flows, and error handling, showing session management and user experience. All tests are compatible with a range of storage providers, including BlobStorage, CosmosDbPartitionedStorage, and FileStorage.

## Requirements

- [Dev Tunnels](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started?tabs=windows) for local development and testing
- Storage providers: BlobStorage, CosmosDbPartitionedStorage, FileStorage, etc
- Azure Bot OAuth connections:
  - **Graph**: [Microsoft's AADv2 setup guide](https://github.com/microsoft/Agents/blob/main/docs/HowTo/azurebot-user-authentication-fic.md#register-the-oauth-identity-with-the-azure-bot)
  - **GitHub**: Requires a GitHub account. In GitHub, go to Settings → Developer settings → OAuth apps, create a new OAuth app, and set the callback URL to `https://token.botframework.com/.auth/web/redirect`. In Azure Bot connection settings, provide the `clientId`, `clientSecret`, and required scopes: `user repo`.

## Reference

- 🧑: User interaction
- 🤖: Bot interaction
- `magic code`: 6-digit code sent by MsTeams
- `/me`: Login route for `graph` auth handler
- `/status`: Login route for `graph` and `github` auth handlers
- `/logout`: Logout route for `graph` and `github` auth handlers
- `oAuthCard`: <br>
  ![oAuthCard](https://github.com/user-attachments/assets/9a639a59-6806-4150-acb2-1144b9ae931b)


## Test Cases

> [!NOTE]
> These test cases were created using the [autoAuth](/samples/auth/autoAuth.ts) sample.

### 1. Normal Flow

**Description:**
User logs in to retrieve information from the Graph provider.

**Steps:**

1. 🧑 → Sends `/me` message
2. 🤖 → Shows `oAuthCard`
3. 🧑 → Clicks `oAuthCard` sign-in button
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
5. 🤖 → Shows signed-in user information from the Graph provider

### 2. Restart Bot After Login

**Description:**
User restarts the bot and checks if the session persists.

**Steps:**

1. 🧑 → Already logged in (see [Normal Flow](#1-normal-flow))
2. 🧑 → Restarts bot
3. 🧑 → Sends `/me` message
4. 🤖 → Shows signed-in user information from the Graph provider

### 3. Login, Restart Bot During Sign-In, and Logout

**Description:**
User logs in, restarts the bot during sign-in, and logs out to verify session handling.

**Steps:**

1. 🧑 → Sends `/me` message
2. 🤖 → Shows `oAuthCard`
5. 🧑 → Restarts bot
3. 🧑 → Clicks `oAuthCard` sign-in button
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
7. 🤖 → Shows signed-in user information from the Graph provider
8. 🧑 → Sends `/me` message
9. 🤖 → Shows signed-in user information from the Graph provider
10. 🧑 → Sends `/logout` message
11. 🤖 → Shows logged-out message

### 4. Logout and Login

**Description:**
User logs out and then logs in again to confirm re-authentication works.

**Steps:**

1. 🧑 → Already logged in (see [Normal Flow](#1-normal-flow))
2. 🧑 → Sends `/logout` message
3. 🧑 → Sends `/me` message
4. 🤖 → Shows `oAuthCard`
5. 🧑 → Clicks `oAuthCard` sign-in button
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams
7. 🤖 → Shows signed-in user information from the Graph provider

### 5. Expired Session

**Description:**
User lets the flow expire, and then tries again, resulting in a session expired message.

**Steps:**

1. 🧑 → Sends `/me` message
2. 🤖 → Shows `oAuthCard`
3. 🧑 → Waits for the flow to expire (or expires it manually from the Storage `flowExpires` property)
5. 🧑 → Clicks `oAuthCard` sign-in button
5. 🤖 → Shows session expired message

### 6. Multi-Handler Login

**Description:**
User checks status and logs in to both handlers to verify multi-handler support.

**Steps:**

1. 🧑 → Sends `/status` message
2. 🤖 → Shows `graph` `oAuthCard`
3. 🧑 → Clicks `oAuthCard` sign-in button
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
5. 🤖 → Shows `github` `oAuthCard`
6. 🧑 → Clicks `oAuthCard` sign-in button
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
8. 🤖 → Shows token status for both auth handlers

### 7. Multi-Handler Logout and Login from One Auth Handler

**Description:**
User checks status, logs out of one handler, and logs in again to verify multi-handler support.

**Steps:**

1. 🧑 → Already logged in (see [Multi-Handler Login](#6-multi-handler-login))
2. 🧑 → Sends `/logout github` message
3. 🤖 → Shows `github` auth handler logged out message
4. 🧑 → Sends `/status` message
5. 🤖 → Shows `github` `oAuthCard`
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
7. 🤖 → Shows token status for both auth handlers

### 8. Multi-Handler Logout and Login from All Auth Handlers

**Description:**
User logs out of all handlers and logs in again to both, confirming full session reset and re-authentication.

**Steps:**

1. 🧑 → Already logged in (see [Multi-Handler Login](#6-multi-handler-login))
2. 🧑 → Sends `/logout` message
3. 🤖 → Shows all handlers logged out message
4. 🧑 → Logs in to both handlers again (see [Multi-Handler Login](#6-multi-handler-login))

### 9. Multi-Server Instances

**Description:**
User simulates having multiple server instances by removing the handler from storage and verifies recovery by re-authenticating, validating that token memory is refreshed.

**Steps:**

1. 🧑 → Sends `/me` message
2. 🤖 → Shows `oAuthCard`
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
4. 🤖 → Shows signed-in user information from the Graph provider
5. 🧑 → Removes handler from storage (simulates wrong memory flow)
6. 🧑 → Sends `/me` message
7. 🤖 → Shows `oAuthCard`
7. 🤖 → Receives the `signin/verifyState` invoke Activity with `magic code` from MsTeams 
9. 🤖 → Shows signed-in user information from the Graph provider




