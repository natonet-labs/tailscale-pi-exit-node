import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/index';

const SLACK_URL = 'https://hooks.slack.test/services/T000/B000/XXX';
const testEnv: Env = {
	...(env as unknown as Env),
	TAILSCALE_CLIENT_ID: 'test-id',
	TAILSCALE_CLIENT_SECRET: 'test-secret',
	SLACK_WEBHOOK_URL: SLACK_URL,
};

type ApiState = { devices?: unknown[]; tokenStatus?: number; devicesStatus?: number };

/**
 * Mock fetch for the Tailscale API and Slack. `api` is read on every call, so
 * a test can change it between cron runs. Returns the Slack messages sent.
 */
function mockApis(api: ApiState): string[] {
	const slackMessages: string[] = [];
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url.endsWith('/oauth/token')) {
			const status = api.tokenStatus ?? 200;
			return status === 200 ? Response.json({ access_token: 'tok' }) : new Response('err', { status });
		}
		if (url.endsWith('/devices')) {
			const status = api.devicesStatus ?? 200;
			return status === 200 ? Response.json({ devices: api.devices ?? [] }) : new Response('err', { status });
		}
		if (url === SLACK_URL) {
			slackMessages.push(JSON.parse(String(init?.body)).text);
			return new Response('ok');
		}
		throw new Error(`unexpected fetch: ${url}`);
	});
	return slackMessages;
}

const onlineNode = () => ({ hostname: 'rpi', connectedToControl: true, lastSeen: new Date().toISOString() });
const offlineNode = () => ({ hostname: 'rpi', connectedToControl: false, lastSeen: new Date(Date.now() - 3_600_000).toISOString() });

async function runCron(): Promise<void> {
	const ctx = createExecutionContext();
	await worker.scheduled({} as ScheduledEvent, testEnv, ctx);
	await waitOnExecutionContext(ctx);
}

describe('tailscale exit node monitor', () => {
	beforeEach(async () => {
		await testEnv.TAILSCALE_STATE.delete('exit_node_state');
		await testEnv.TAILSCALE_STATE.delete('monitor_error');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('stays quiet and writes nothing to KV while the node is online', async () => {
		const slack = mockApis({ devices: [onlineNode()] });
		const put = vi.spyOn(testEnv.TAILSCALE_STATE, 'put');
		await runCron();
		await runCron();
		expect(slack).toEqual([]);
		expect(put).not.toHaveBeenCalled();
	});

	it('alerts once when the node goes offline', async () => {
		const slack = mockApis({ devices: [offlineNode()] });
		await runCron();
		await runCron();
		expect(slack).toHaveLength(1);
		expect(slack[0]).toContain('went OFFLINE');
		expect(await testEnv.TAILSCALE_STATE.get('exit_node_state')).toBe('offline');
	});

	it('alerts when the node comes back online', async () => {
		await testEnv.TAILSCALE_STATE.put('exit_node_state', 'offline');
		const slack = mockApis({ devices: [onlineNode()] });
		await runCron();
		expect(slack).toHaveLength(1);
		expect(slack[0]).toContain('back ONLINE');
		expect(await testEnv.TAILSCALE_STATE.get('exit_node_state')).toBe('online');
	});

	it('alerts when the node is missing from the tailnet', async () => {
		const slack = mockApis({ devices: [{ hostname: 'some-other-host' }] });
		await runCron();
		expect(slack).toHaveLength(1);
		expect(slack[0]).toContain("'rpi' not found");
	});

	it('alerts once while the Tailscale API stays down, then once on recovery', async () => {
		const api: ApiState = { tokenStatus: 503, devices: [onlineNode()] };
		const slack = mockApis(api);
		await runCron();
		api.tokenStatus = 502; // a different status code is still the same outage
		await runCron();
		await runCron();
		expect(slack).toEqual(['❌ Failed to get Tailscale token: 503']);

		api.tokenStatus = 200;
		await runCron();
		await runCron();
		expect(slack).toHaveLength(2);
		expect(slack[1]).toContain('monitoring recovered (was failing: token)');
		expect(await testEnv.TAILSCALE_STATE.get('monitor_error')).toBeNull();
	});

	it('alerts again when a different kind of error starts', async () => {
		const api: ApiState = { tokenStatus: 503 };
		const slack = mockApis(api);
		await runCron();
		api.tokenStatus = 200;
		api.devicesStatus = 500;
		await runCron();
		await runCron();
		expect(slack).toEqual(['❌ Failed to get Tailscale token: 503', '❌ Failed to fetch devices: 500']);
	});

	it('still reports the node going offline after recovering from an API error', async () => {
		const api: ApiState = { tokenStatus: 503, devices: [offlineNode()] };
		const slack = mockApis(api);
		await runCron();
		api.tokenStatus = 200;
		await runCron();
		expect(slack).toHaveLength(3);
		expect(slack[1]).toContain('monitoring recovered');
		expect(slack[2]).toContain('went OFFLINE');
	});
});
