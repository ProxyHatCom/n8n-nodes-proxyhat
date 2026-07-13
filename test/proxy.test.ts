import { afterEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();

// Keep the real connection grammar (offline) and only mock the networked client.
vi.mock('proxyhat', async (importOriginal) => {
	const actual = await importOriginal<typeof import('proxyhat')>();
	return {
		...actual,
		ProxyHat: class {
			sub_users = { list: listMock };
		},
	};
});

const { buildProxyConnection, buildTargeting, resolveGatewayCredentials } = await import(
	'../nodes/ProxyHat/proxy'
);

afterEach(() => {
	listMock.mockReset();
});

describe('buildProxyConnection', () => {
	const creds = { username: 'user', password: 'pass' };

	it('builds a rotating HTTP gateway URL by default', () => {
		const c = buildProxyConnection(creds, { country: 'us' });
		expect(c.url).toContain('gate.proxyhat.com:8080');
		expect(c.url).toContain('country-us');
		expect(c.url).not.toContain('-sid-');
		expect(c.host).toBe('gate.proxyhat.com');
		expect(c.port).toBe(8080);
		expect(c.protocol).toBe('http');
	});

	it('splits the URL into proxy parts with the targeting username', () => {
		const c = buildProxyConnection(creds, { country: 'de', region: 'berlin' });
		expect(c.username).toContain('user-country-de-region-berlin');
		expect(c.password).toBe('pass');
		// The parsed username must match the one embedded in the URL.
		expect(c.url).toContain(encodeURIComponent(c.username));
	});

	it('pins a sticky session with a TTL when sticky is on', () => {
		const c = buildProxyConnection(creds, { country: 'us', sticky: true });
		expect(c.username).toContain('-sid-');
		expect(c.username).toContain('-ttl-30m');
	});

	it('respects a custom sticky TTL', () => {
		const c = buildProxyConnection(creds, { sticky: true, stickyTtl: '12h' });
		expect(c.username).toContain('-ttl-12h');
	});

	it('supports the socks5 protocol and port', () => {
		const c = buildProxyConnection(creds, { protocol: 'socks5', country: 'us' });
		expect(c.url.startsWith('socks5://')).toBe(true);
		expect(c.port).toBe(1080);
	});

	it('applies the IP-quality filter but drops "none"', () => {
		expect(buildProxyConnection(creds, { filter: 'high' }).username).toContain('filter-high');
		expect(buildProxyConnection(creds, { filter: 'none' }).username).not.toContain('filter');
	});
});

describe('buildTargeting', () => {
	it('omits blank fields and the "none" filter', () => {
		expect(buildTargeting({ country: '  ', filter: 'none', sticky: false })).toEqual({});
	});

	it('defaults the sticky TTL to 30m', () => {
		expect(buildTargeting({ sticky: true })).toEqual({ sticky: '30m' });
	});
});

describe('resolveGatewayCredentials', () => {
	it('uses explicit username/password without touching the API', async () => {
		const creds = await resolveGatewayCredentials({ username: 'u', password: 'p' });
		expect(creds).toEqual({ username: 'u', password: 'p' });
		expect(listMock).not.toHaveBeenCalled();
	});

	it('auto-picks the first active sub-user from an API key', async () => {
		listMock.mockResolvedValue([
			{ uuid: '1', name: 'dead', suspended_at: '2026-01-01', traffic_limit: 0, used_traffic: 0, proxy_username: 'x', proxy_password: 'y' },
			{ uuid: '2', name: 'live', suspended_at: null, traffic_limit: 0, used_traffic: 5, proxy_username: 'gwu', proxy_password: 'gwp' },
		]);
		expect(await resolveGatewayCredentials({ apiKey: 'ph_key' })).toEqual({
			username: 'gwu',
			password: 'gwp',
		});
	});

	it('skips sub-users that are out of traffic', async () => {
		listMock.mockResolvedValue([
			{ uuid: '1', name: 'full', suspended_at: null, traffic_limit: 100, used_traffic: 100, proxy_username: 'x', proxy_password: 'y' },
			{ uuid: '2', name: 'ok', suspended_at: null, traffic_limit: 100, used_traffic: 10, proxy_username: 'gwu', proxy_password: 'gwp' },
		]);
		expect(await resolveGatewayCredentials({ apiKey: 'ph_key' })).toEqual({
			username: 'gwu',
			password: 'gwp',
		});
	});

	it('picks a named sub-user when subUser is given', async () => {
		listMock.mockResolvedValue([
			{ uuid: '1', name: 'us-pool', suspended_at: null, traffic_limit: 0, used_traffic: 0, proxy_username: 'usu', proxy_password: 'usp' },
			{ uuid: '2', name: 'eu-pool', suspended_at: null, traffic_limit: 0, used_traffic: 0, proxy_username: 'euu', proxy_password: 'eup' },
		]);
		expect(await resolveGatewayCredentials({ apiKey: 'ph_key', subUser: 'eu-pool' })).toEqual({
			username: 'euu',
			password: 'eup',
		});
	});

	it('throws when nothing is configured', async () => {
		await expect(resolveGatewayCredentials({})).rejects.toThrow(/no credentials/);
	});

	it('throws when no sub-user is usable', async () => {
		listMock.mockResolvedValue([
			{ uuid: '1', name: 'dead', suspended_at: '2026-01-01', traffic_limit: 0, used_traffic: 0, proxy_username: 'x', proxy_password: 'y' },
		]);
		await expect(resolveGatewayCredentials({ apiKey: 'ph_key' })).rejects.toThrow(
			/no usable sub-user/,
		);
	});
});
