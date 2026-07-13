import {
	buildConnectionUrl,
	ProxyHat,
	type ConnectionTargeting,
	type ProxyProtocol,
} from 'proxyhat';

/** Credential shape as stored by the ProxyHat API credential type. */
export interface ProxyHatCredential {
	authType?: 'apiKey' | 'usernamePassword';
	apiKey?: string;
	subUser?: string;
	username?: string;
	password?: string;
	baseUrl?: string;
}

/** Resolved sub-user gateway login. */
export interface GatewayCredentials {
	username: string;
	password: string;
}

/** Geo / sticky targeting collected from the node's parameters. */
export interface ProxyHatTargetingOptions {
	protocol?: ProxyProtocol;
	country?: string;
	region?: string;
	city?: string;
	filter?: string;
	sticky?: boolean;
	stickyTtl?: string;
}

/** A ready-to-use proxy, both as a URL and as split parts for n8n's `proxy` option. */
export interface ProxyConnection {
	/** Full `http(s)://user-country-…:pass@gate.proxyhat.com:8080` URL. */
	url: string;
	protocol: ProxyProtocol;
	host: string;
	port: number;
	/** Gateway username with the targeting grammar applied. */
	username: string;
	password: string;
}

function trimmed(value: string | undefined): string | undefined {
	const out = value?.trim();
	return out ? out : undefined;
}

/**
 * Resolve gateway credentials from a ProxyHat credential.
 *
 * Precedence mirrors the other ProxyHat integrations: explicit
 * `username`/`password` win; otherwise an API key lists your sub-users and
 * picks an active one with remaining traffic (or the one named by `subUser`).
 * The API lookup is the only networked path — building URLs is fully offline.
 */
export async function resolveGatewayCredentials(
	credential: ProxyHatCredential,
): Promise<GatewayCredentials> {
	const username = trimmed(credential.username);
	const password = trimmed(credential.password);
	if (username && password) return { username, password };

	const apiKey = trimmed(credential.apiKey);
	if (!apiKey) {
		throw new Error(
			'ProxyHat: no credentials. Provide an API key, or a gateway username and password.',
		);
	}

	const client = new ProxyHat({ apiKey, baseUrl: trimmed(credential.baseUrl) });
	const list = await client.sub_users.list();
	const want = trimmed(credential.subUser);
	const usable = list.filter(
		(s) => !s.suspended_at && (s.traffic_limit === 0 || s.used_traffic < s.traffic_limit),
	);
	const chosen = want ? list.find((s) => s.uuid === want || s.name === want) : usable[0];

	if (!chosen?.proxy_username || !chosen?.proxy_password) {
		throw new Error(
			want
				? `ProxyHat: no sub-user matched "${want}" (or it has no proxy credentials).`
				: 'ProxyHat: no usable sub-user found (all suspended or out of traffic). ' +
					'Create one, top it up, or pick a specific sub-user.',
		);
	}
	return { username: chosen.proxy_username, password: chosen.proxy_password };
}

/** Turn node parameters into the SDK's {@link ConnectionTargeting} shape. */
export function buildTargeting(options: ProxyHatTargetingOptions): ConnectionTargeting {
	const targeting: ConnectionTargeting = {};
	const country = trimmed(options.country);
	const region = trimmed(options.region);
	const city = trimmed(options.city);
	const filter = trimmed(options.filter);
	if (country) targeting.country = country;
	if (region) targeting.region = region;
	if (city) targeting.city = city;
	if (filter && filter !== 'none') targeting.filter = filter;
	if (options.sticky) targeting.sticky = trimmed(options.stickyTtl) ?? '30m';
	return targeting;
}

/**
 * Build a ProxyHat gateway connection for the given credentials and targeting.
 *
 * Uses the official `proxyhat` SDK's `buildConnectionUrl` for the grammar, then
 * parses the URL back into host/port/auth parts so the same connection can feed
 * either a downstream HTTP Request node (the URL) or n8n's own `proxy` request
 * option (the parts) — always with one consistent sticky session id.
 */
export function buildProxyConnection(
	credentials: GatewayCredentials,
	options: ProxyHatTargetingOptions = {},
): ProxyConnection {
	const protocol: ProxyProtocol = options.protocol === 'socks5' ? 'socks5' : 'http';
	const url = buildConnectionUrl({
		username: credentials.username,
		password: credentials.password,
		protocol,
		...buildTargeting(options),
	});
	const parsed = new URL(url);
	return {
		url,
		protocol,
		host: parsed.hostname,
		port: Number(parsed.port),
		username: decodeURIComponent(parsed.username),
		password: decodeURIComponent(parsed.password),
	};
}
