import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ProxyHatApi implements ICredentialType {
	name = 'proxyHatApi';

	displayName = 'ProxyHat API';

	documentationUrl = 'https://docs.proxyhat.com/connecting';

	properties: INodeProperties[] = [
		{
			displayName: 'Authentication',
			name: 'authType',
			type: 'options',
			options: [
				{
					name: 'API Key',
					value: 'apiKey',
					description: 'Auto-selects an active residential sub-user',
				},
				{
					name: 'Gateway Username & Password',
					value: 'usernamePassword',
					description: "A sub-user's proxy_username and proxy_password",
				},
			],
			default: 'apiKey',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'ProxyHat account API key. Picks an active sub-user with remaining traffic. Get one at proxyhat.com.',
			displayOptions: { show: { authType: ['apiKey'] } },
		},
		{
			displayName: 'Sub-User',
			name: 'subUser',
			type: 'string',
			default: '',
			placeholder: 'us-pool',
			description:
				'Optional. Pick a specific sub-user by name or UUID instead of auto-selecting one.',
			displayOptions: { show: { authType: ['apiKey'] } },
		},
		{
			displayName: 'Gateway Username',
			name: 'username',
			type: 'string',
			default: '',
			description: "A sub-user's proxy_username (skips the account API)",
			displayOptions: { show: { authType: ['usernamePassword'] } },
		},
		{
			displayName: 'Gateway Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: "The matching proxy_password",
			displayOptions: { show: { authType: ['usernamePassword'] } },
		},
	];

	// Injects the account API key as a Bearer token. Only used by the apiKey
	// auth mode; in usernamePassword mode `apiKey` is empty and this is a no-op.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// "Test credential" button. Validates the account API key against the
	// management API — a 200 from /sub-users means the key is good. This only
	// applies to the apiKey mode; the gateway username/password mode has no
	// account-API surface to test against.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.proxyhat.com/v1',
			url: '/sub-users',
		},
	};
}
