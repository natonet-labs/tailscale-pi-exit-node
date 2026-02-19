/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  TAILSCALE_CLIENT_ID: string;
  TAILSCALE_CLIENT_SECRET: string;
  SLACK_WEBHOOK_URL: string;
  TAILSCALE_STATE: KVNamespace;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkTailscaleNode(env));
  },
};

async function checkTailscaleNode(env: Env): Promise<void> {
  const EXIT_NODE_NAME = "raspberrypi"; // change to your Pi hostname

  try {
    const tokenResponse = await fetch("https://api.tailscale.com/api/v2/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        "client_id=" +
        encodeURIComponent(env.TAILSCALE_CLIENT_ID) +
        "&client_secret=" +
        encodeURIComponent(env.TAILSCALE_CLIENT_SECRET) +
        "&grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      await sendSlackAlert(env, `❌ Failed to get Tailscale token: ${tokenResponse.status}`);
      return;
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const accessToken = tokenData.access_token;

    const devicesResponse = await fetch("https://api.tailscale.com/api/v2/tailnet/-/devices", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!devicesResponse.ok) {
      await sendSlackAlert(env, `❌ Failed to fetch devices: ${devicesResponse.status}`);
      return;
    }

    const devicesData = (await devicesResponse.json()) as { devices: any[] };
    // console.log("Devices:", devicesData.devices.map((d) => ({ hostname: d.hostname, online: d.clientConnectivity?.endpoints?.length ?? 0 })));

    const exitNode = devicesData.devices.find((d) => d.hostname === EXIT_NODE_NAME);
    // console.log("Found exit node:", exitNode ? exitNode.hostname : "NOT FOUND");

    if (!exitNode) {
      await sendSlackAlert(env, `⚠️ Exit node '${EXIT_NODE_NAME}' not found in tailnet`);
      return;
    }

    // Consider it online if: connectedToControl is true and lastSeen is within the last 5 minutes (300000 ms)
    const now = Date.now();
    const lastSeen = exitNode.lastSeen ? Date.parse(exitNode.lastSeen) : 0;
    const isOnline = exitNode.connectedToControl === true && lastSeen > 0 && now - lastSeen <= 5 * 60 * 1000;
    const previousState = (await env.TAILSCALE_STATE.get("exit_node_state")) ?? "online";

    // console.log(
    //   new Date().toISOString(),
    //   "isOnline:", isOnline,
    //   "previousState:", previousState,
    //   "connectedToControl:", exitNode.connectedToControl,
    //   "lastSeen:", exitNode.lastSeen
    // );

    if (!isOnline && previousState === "online") {
      await sendSlackAlert(env, `🚨 Tailscale exit node '${EXIT_NODE_NAME}' went OFFLINE`);
      await env.TAILSCALE_STATE.put("exit_node_state", "offline");
    } else if (isOnline && previousState === "offline") {
      await sendSlackAlert(env, `✅ Tailscale exit node '${EXIT_NODE_NAME}' is back ONLINE`);
      await env.TAILSCALE_STATE.put("exit_node_state", "online");
    } else if (isOnline) {
      await env.TAILSCALE_STATE.put("exit_node_state", "online");
    }
  } catch (err: any) {
    // console.log("Error in checkTailscaleNode:", err);
    await sendSlackAlert(env, `❌ Monitoring error: ${err?.message ?? String(err)}`);
  }
}

async function sendSlackAlert(env: Env, message: string): Promise<void> {
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}
