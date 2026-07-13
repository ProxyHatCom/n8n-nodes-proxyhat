import type { ICredentialType, INodeProperties } from 'n8n-workflow';

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
}
