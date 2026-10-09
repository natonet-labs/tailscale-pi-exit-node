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

/** Mock fetch: token + device list from the Tailscale API, record Slack posts. */
function mockApis(devices: unknown[]): string[] {
	const slackMessages: string[] = [];
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url.endsWith('/oauth/token')) return Response.json({ access_token: 'tok' });
		if (url.endsWith('/devices')) return Response.json({ devices });
		if (url === SLACK_URL) {
			slackMessages.push(JSON.parse(String(init?.body)).text);
			return new Response('ok');
		}
		throw new Error(`unexpected fetch: ${url}`);
	});
	return slackMessages;
}

const onlineNode = () => ({ hostname: 'raspberrypi', connectedToControl: true, lastSeen: new Date().toISOString() });
const offlineNode = () => ({ hostname: 'raspberrypi', connectedToControl: false, lastSeen: new Date(Date.now() - 3_600_000).toISOString() });

async function runCron(): Promise<void> {
	const ctx = createExecutionContext();
	await worker.scheduled({} as ScheduledEvent, testEnv, ctx);
	await waitOnExecutionContext(ctx);
}

describe('tailscale exit node monitor', () => {
	beforeEach(async () => {
		await testEnv.TAILSCALE_STATE.delete('exit_node_state');
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('stays quiet while the node is online', async () => {
		const slack = mockApis([onlineNode()]);
		await runCron();
		expect(slack).toEqual([]);
		expect(await testEnv.TAILSCALE_STATE.get('exit_node_state')).toBe('online');
	});

	it('alerts once when the node goes offline', async () => {
		const slack = mockApis([offlineNode()]);
		await runCron();
		await runCron();
		expect(slack).toHaveLength(1);
		expect(slack[0]).toContain('went OFFLINE');
		expect(await testEnv.TAILSCALE_STATE.get('exit_node_state')).toBe('offline');
	});

	it('alerts when the node comes back online', async () => {
		await testEnv.TAILSCALE_STATE.put('exit_node_state', 'offline');
		const slack = mockApis([onlineNode()]);
		await runCron();
		expect(slack).toHaveLength(1);
		expect(slack[0]).toContain('back ONLINE');
		expect(await testEnv.TAILSCALE_STATE.get('exit_node_state')).toBe('online');
	});

	it('alerts when the node is missing from the tailnet', async () => {
		const slack = mockApis([{ hostname: 'some-other-host' }]);
		await runCron();
		expect(slack).toHaveLength(1);
		expect(slack[0]).toContain("'raspberrypi' not found");
	});
});
