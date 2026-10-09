/**
 * Tailscale exit node monitor.
 *
 * Runs on a cron trigger (see wrangler.jsonc), asks the Tailscale API whether
 * the exit node is connected, and posts to Slack only when its state changes
 * (online → offline or offline → online). The last known state lives in KV.
 *
 * KV is written only on changes: a missing state means "online", and an
 * ongoing monitoring error (e.g. the Tailscale API is down) is alerted once
 * when it starts and once when it clears, not on every run.
 *
 * Secrets: TAILSCALE_CLIENT_ID, TAILSCALE_CLIENT_SECRET, SLACK_WEBHOOK_URL.
 * See GUIDE_CLOUDFLARE_MONITOR.md for setup.
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
  const EXIT_NODE_NAME = "rpi"; // change to your Pi hostname

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
      await reportError(env, "token", `❌ Failed to get Tailscale token: ${tokenResponse.status}`);
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
      await reportError(env, "devices", `❌ Failed to fetch devices: ${devicesResponse.status}`);
      return;
    }

    const devicesData = (await devicesResponse.json()) as { devices: any[] };
    // console.log("Devices:", devicesData.devices.map((d) => ({ hostname: d.hostname, online: d.clientConnectivity?.endpoints?.length ?? 0 })));

    const exitNode = devicesData.devices.find((d) => d.hostname === EXIT_NODE_NAME);
    // console.log("Found exit node:", exitNode ? exitNode.hostname : "NOT FOUND");

    if (!exitNode) {
      await reportError(env, "not_found", `⚠️ Exit node '${EXIT_NODE_NAME}' not found in tailnet`);
      return;
    }

    await clearError(env);

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
    }
  } catch (err: any) {
    // console.log("Error in checkTailscaleNode:", err);
    await reportError(env, "exception", `❌ Monitoring error: ${err?.message ?? String(err)}`);
  }
}

// Ongoing monitoring error, by kind ("token", "devices", "not_found",
// "exception"). Kinds rather than full messages, so a flapping status code
// (502, then 503) doesn't re-alert.
const ERROR_KEY = "monitor_error";

async function reportError(env: Env, kind: string, message: string): Promise<void> {
  if ((await env.TAILSCALE_STATE.get(ERROR_KEY)) === kind) return; // already alerted
  await sendSlackAlert(env, message);
  await env.TAILSCALE_STATE.put(ERROR_KEY, kind);
}

async function clearError(env: Env): Promise<void> {
  const kind = await env.TAILSCALE_STATE.get(ERROR_KEY);
  if (kind === null) return;
  await env.TAILSCALE_STATE.delete(ERROR_KEY);
  await sendSlackAlert(env, `✅ Tailscale monitoring recovered (was failing: ${kind})`);
}

async function sendSlackAlert(env: Env, message: string): Promise<void> {
  await fetch(env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}
