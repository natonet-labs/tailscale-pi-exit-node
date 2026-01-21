# Cloudflare Worker Tailscale Monitor

```mermaid
flowchart LR
    %% User traffic path
    U[User Device]
    R[GL-MT3000 - Travel Router]
    W[Public WiFi - Internet]
    T[Tailscale Mesh VPN]
    P[Raspberry Pi - Exit Node]

    %% Monitoring/alerting path
    C[Cloudflare Worker - Tailscale Monitor]
    K[Cloudflare KV - TAILSCALE_STATE]
    S[Slack - Alerts]

    %% User traffic flow
    U --> R --> W --> T --> P

    %% Monitoring flow
    C -- "Every N minutes (checks Tailscale API for Pi status)" --> T
    T --> C
    C <---> K

    %% Conditional alerts
    C -- "Pi status = DOWN (state change offline)" --> S
    C -- "Pi status = UP (state change online)" --> S
```

## 1. Prerequisites

- A **Tailscale** tailnet with your Raspberry Pi configured as an exit node (or at least visible as a device).[^1] [^2]
- A **Slack** workspace where you can create an Incoming Webhook.[^3]
- A free **Cloudflare** account (we’ll create one).[^4]
- A dev machine with **Node.js** and **npm** installed.[^5]

***

## 2. Create a Tailscale OAuth client (devices:read only)

1. Open **Tailscale Admin Console** in your browser:
    - Go to `https://login.tailscale.com/admin`.[^6]
2. Go to **Settings → Trust credentials**:
    - Left sidebar: click **Settings**.
    - Under Settings, choose **Trust credentials**.[^7]
3. Click **New credential** (or similar button).
4. Choose **OAuth** as the credential type.[^6] [^7]
5. On the OAuth configuration screen:
    - When asked **All Reads vs Custom scopes**, select **Custom scopes**.[^7] [^6]
    - Under **devices**, expand it and choose:
        - Check **core**.
        - Make sure permission is **Read** (not Write).[^6] [^7]
    - Leave other sections (posture attributes, routes, device invites, ACL, DNS, etc.) **unchecked**.[^7]
6. Create the OAuth credential.
    - Tailscale will show two important values:
        - **Client ID**
        - **Client secret**
    - Copy and save both somewhere secure; the **Client secret may only be shown once**.[^8] [^6]

You now have:

- `TAILSCALE_CLIENT_ID`  → Tailscale OAuth **Client ID**
- `TAILSCALE_CLIENT_SECRET` → Tailscale OAuth **Client secret**

***

## 3. Create a Slack Incoming Webhook

1. Go to **Slack API Apps**:
    - Visit `https://api.slack.com/apps`.[^3]
2. Click **Create New App** → **From scratch**.[^3]
3. App name and workspace:
    - Give it a name (e.g., `Tailscale Monitor`).
    - Choose your workspace.
4. In the left menu, go to **Incoming Webhooks**.[^3]
5. Turn **Incoming Webhooks** ON.[^3]
6. Click **Add New Webhook to Workspace**.[^3]
    - Choose the channel where you want alerts (e.g., `#alerts`).
    - Click **Allow**.
7. Copy the generated **Webhook URL**, which looks like:
`https://hooks.slack.com/services/XXX/YYY/ZZZ`.[^3]

You now have:

- `SLACK_WEBHOOK_URL` → that full Slack webhook URL.

Optional quick test from your machine:[^9] [^10]

```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"text":"Tailscale monitor test from terminal"}' \
  https://hooks.slack.com/services/XXX/YYY/ZZZ
```

You should see the test message in Slack.

***

## 4. Sign up for a free Cloudflare account

1. Go to `https://dash.cloudflare.com/sign-up`.[^11]
2. Create an account with your email/password.
3. You do **not** need to add a website/domain just to use Workers.[^4]

***

## 5. Install Wrangler (Cloudflare CLI)

On your dev machine:[^12] [^5]

1. Install Wrangler globally:
```bash
npm install -g wrangler
```

2. Log in to Cloudflare:
```bash
wrangler login
```

- A browser window opens; log in with your Cloudflare account.
- After approval, Wrangler is authorized to manage Workers in your account.[^12]

***

## 6. Create the Worker project (TypeScript)

1. Make a working folder and run `wrangler init`:
```bash
mkdir tailscale-monitor
cd tailscale-monitor
wrangler init
```

Wrangler will prompt you (as you saw):

- **Directory**: confirm `./tailscale-monitor` (or accept default).
- **What would you like to start with?**
    - Choose: **Hello World example**.
- **Use TypeScript?**
    - Choose: **Yes** (you did).
- **Use git?**
    - Optional: **Yes** or **No**.
- **Do you want to deploy?**
    - Choose: **No** for now (you’ll deploy after configuration).

2. Enter the generated project folder if Wrangler created a nested one:
```bash
cd tailscale-monitor  # if tailscale-monitor/tailscale-monitor exists
ls
```

You should see:

- `wrangler.jsonc`
- `src/index.ts`
- `package.json`, etc.

***

## 7. Configure wrangler.jsonc

Open `wrangler.jsonc` and ensure it looks like this:

```jsonc
{
  "name": "tailscale-monitor",
  "triggers": {
    "crons": ["*/15 * * * *"]
  },
  "kv_namespaces": [
    {
      "binding": "TAILSCALE_STATE",
      "id": "xxx"
    }
  ]
  ...
}
```

Notes:

- `crons` → `"*/15 * * * *"` = run every 15 minutes.[^13]
- The `kv_namespaces.id` will be filled in the next step; if you’re starting fresh, you can temporarily leave `"id": ""` and let Wrangler add it.

***

## 8. Create the KV namespace (TAILSCALE_STATE)

From inside the project folder (where `wrangler.jsonc` lives):[^14]

```bash
wrangler kv namespace create TAILSCALE_STATE
```

You’ll see output similar to this:

```text
Creating namespace with title "TAILSCALE_STATE"
Success!
{
  "kv_namespaces": [
    {
      "binding": "TAILSCALE_STATE",
      "id": "xxx"
    }
  ]
}
✔ Would you like Wrangler to add it on your behalf? … yes
✔ What binding name would you like to use? … TAILSCALE_STATE
? For local dev, do you want to connect to the remote resource instead of a local resource? › (y/N)
```

- Answer **yes** when asked to add it to your config.
- When prompted “For local dev…”, choose **N** (No).[^15] [^16]

This updates `wrangler.jsonc` automatically with the correct `id`.

***

## 9. Put the monitoring code into src/index.ts (TypeScript)

Open `src/index.ts` and replace its content with this pattern:

```ts
const EXIT_NODE_NAME = "raspberrypi"; // change this to match your Pi's hostname exactly

export interface Env {
  ...
}

export default {
  ...
};

async function checkTailscaleNode(env: Env): Promise<void> {
  ...
}

async function sendSlackAlert(env: Env, message: string): Promise<void> {
  ...
}
```

Important:

- Set `EXIT_NODE_NAME` to match the Pi’s **hostname in Tailscale**, e.g. `"raspberrypi"` or `"pi5"` exactly.[^2] [^1]

***

## 10. Add the Tailscale and Slack secrets to the Worker

From the project directory:

1. Set the Tailscale OAuth Client ID:
```bash
wrangler secret put TAILSCALE_CLIENT_ID
```

- When prompted `Enter a secret value:`, paste the **Client ID** from your Tailscale OAuth credential.[^8] [^6]
- If it says “There doesn’t seem to be a Worker called ‘tailscale-monitor’… create one?” answer **Y** once.

2. Set the Tailscale OAuth Client Secret:
```bash
wrangler secret put TAILSCALE_CLIENT_SECRET
```

- Paste the **Client secret** from your Tailscale OAuth credential.[^8] [^6]

3. Set the Slack webhook:
```bash
wrangler secret put SLACK_WEBHOOK_URL
```

- Paste the Slack Incoming Webhook URL.[^17] [^3]

Each of these is stored securely by Cloudflare and made available as `env.TAILSCALE_CLIENT_ID`, etc.[^18] [^12]

***

## 11. Deploy the Worker

From the same folder:

```bash
wrangler deploy
```

You should see output similar to this:

- Upload size
- Binding info for `TAILSCALE_STATE` KV
- Deployed triggers with schedule `*/15 * * * *`[^13] [^12]

Because you set `"workers_dev": false`, you won’t rely on the public `.workers.dev` URL — your Worker just runs on schedule.

***

## 12. Verify it’s working

### A. Tail logs

Run:

```bash
wrangler tail
```

Then wait for the next 15-minute tick. Watch for:

- No errors → normal checks.
- Slack alert messages when the Pi goes offline or comes back.[^19] [^20]


### B. Functional test

1. Ensure Pi is online in Tailscale → no alerts for a couple of runs.[^1]
2. Power off or disconnect the Pi → next run should send:
    - `🚨 Tailscale exit node '...' went OFFLINE`
3. Power Pi back on → after it reconnects, next run should send:
    - `✅ Tailscale exit node '...' is back ONLINE`

At this point, Cloudflare + Tailscale + Slack monitoring is fully set up.[^21] [^22] [^13]

***
Sources:

[^1]: https://tailscale.com/kb/1017/install

[^2]: https://tailscale.com/kb/1326/device-identity

[^3]: https://docs.slack.dev/tools/java-slack-sdk/guides/incoming-webhooks/

[^4]: https://www.cloudflare.com/plans/developer-platform/

[^5]: https://www.npmjs.com/package/wrangler

[^6]: https://tailscale.com/kb/1215/oauth-clients

[^7]: https://tailscale.com/kb/1623/trust-credentials

[^8]: https://tailscale.com/kb/1252/key-secret-management

[^9]: https://dev.to/mattleads/completing-the-loop-a-developers-guide-to-slack-incoming-webhooks-4cdd

[^10]: https://www.magicbell.com/blog/how-to-create-a-slack-webhook-url

[^11]: https://www.cloudflare.com/plans/

[^12]: https://developers.cloudflare.com/workers/wrangler/

[^13]: https://developers.cloudflare.com/workers/configuration/cron-triggers/

[^14]: https://developers.cloudflare.com/kv/reference/kv-commands/

[^15]: https://developers.cloudflare.com/kv/get-started/

[^16]: https://ts.cloudflare.community/workers/wrangler/workers-kv/

[^17]: https://docs.testkube.io/articles/slack-integration

[^18]: https://blog.cloudflare.com/10-things-i-love-about-wrangler/

[^19]: https://developers.cloudflare.com/workers/wrangler/commands/

[^20]: https://ts.cloudflare.community/workers/wrangler/commands/

[^21]: https://github.com/ashishjullia/cloudflare-worker-tailscale-monitor

[^22]: https://www.reddit.com/r/Tailscale/comments/1kmtuzn/i_built_an_opensource_tailscale_device_monitor/
