import {
	NodeOperationError,
	type IExecuteFunctions,
	type IDataObject,
	type IHttpRequestMethods,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	buildProxyConnection,
	resolveGatewayCredentials,
	type ProxyHatCredential,
	type ProxyHatTargetingOptions,
} from './proxy';

export class ProxyHat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ProxyHat',
		name: 'proxyHat',
		icon: 'file:proxyhat.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Route requests through ProxyHat residential proxies',
		defaults: {
			name: 'ProxyHat',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'proxyHatApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Proxy URL',
						value: 'getProxyUrl',
						description:
							'Build a ProxyHat gateway URL for a downstream HTTP Request node',
						action: 'Build a proxy URL',
					},
					{
						name: 'Fetch URL',
						value: 'fetchUrl',
						description: 'Fetch a URL through the residential proxy and return body + status',
						action: 'Fetch a URL through the proxy',
					},
				],
				default: 'getProxyUrl',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://httpbin.org/ip',
				description: 'The URL to fetch through the residential proxy',
				displayOptions: { show: { operation: ['fetchUrl'] } },
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'HEAD', value: 'HEAD' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
					{ name: 'DELETE', value: 'DELETE' },
				],
				default: 'GET',
				displayOptions: { show: { operation: ['fetchUrl'] } },
			},
			{
				displayName: 'Protocol',
				name: 'protocol',
				type: 'options',
				options: [
					{ name: 'HTTP (port 8080)', value: 'http' },
					{ name: 'SOCKS5 (port 1080)', value: 'socks5' },
				],
				default: 'http',
				description: 'Gateway protocol for the built URL',
				displayOptions: { show: { operation: ['getProxyUrl'] } },
			},
			{
				displayName: 'Targeting',
				name: 'targeting',
				type: 'collection',
				placeholder: 'Add Targeting',
				default: {},
				description: 'Choose which residential IPs the gateway exits from',
				options: [
					{
						displayName: 'Country',
						name: 'country',
						type: 'string',
						default: '',
						placeholder: 'us',
						description: 'ISO country code to exit from, e.g. "us", "de". Blank = any.',
					},
					{
						displayName: 'Region',
						name: 'region',
						type: 'string',
						default: '',
						placeholder: 'california',
						description: 'State / region slug',
					},
					{
						displayName: 'City',
						name: 'city',
						type: 'string',
						default: '',
						placeholder: 'new_york',
						description: 'City slug',
					},
					{
						displayName: 'IP Quality Filter',
						name: 'filter',
						type: 'options',
						default: 'none',
						description: 'AI IP-quality / speed tier',
						options: [
							{ name: 'None', value: 'none' },
							{ name: 'High', value: 'high' },
							{ name: 'Medium', value: 'medium' },
							{ name: 'High (Speed Fast)', value: 'high-speed-fast' },
							{ name: 'Medium (Speed Fast)', value: 'medium-speed-fast' },
						],
					},
				],
			},
			{
				displayName: 'Sticky Session',
				name: 'sticky',
				type: 'boolean',
				default: false,
				description:
					'Whether to keep one residential IP across requests instead of rotating a fresh IP each time',
			},
			{
				displayName: 'Sticky TTL',
				name: 'stickyTtl',
				type: 'string',
				default: '30m',
				placeholder: '30m',
				description: 'How long to keep the sticky IP, e.g. "30m" or "12h"',
				displayOptions: { show: { sticky: [true] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credential = (await this.getCredentials('proxyHatApi')) as ProxyHatCredential;

		let gateway;
		try {
			gateway = await resolveGatewayCredentials(credential);
		} catch (error) {
			throw new NodeOperationError(this.getNode(), error as Error);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const targeting = this.getNodeParameter('targeting', i, {}) as IDataObject;
				const sticky = this.getNodeParameter('sticky', i, false) as boolean;
				const stickyTtl = sticky
					? (this.getNodeParameter('stickyTtl', i, '30m') as string)
					: undefined;

				const options: ProxyHatTargetingOptions = {
					country: targeting.country as string | undefined,
					region: targeting.region as string | undefined,
					city: targeting.city as string | undefined,
					filter: targeting.filter as string | undefined,
					sticky,
					stickyTtl,
				};

				if (operation === 'getProxyUrl') {
					const protocol = this.getNodeParameter('protocol', i, 'http') as 'http' | 'socks5';
					const connection = buildProxyConnection(gateway, { ...options, protocol });
					returnData.push({
						json: {
							proxyUrl: connection.url,
							protocol: connection.protocol,
							host: connection.host,
							port: connection.port,
							username: connection.username,
							password: connection.password,
						},
						pairedItem: { item: i },
					});
					continue;
				}

				// operation === 'fetchUrl' — axios-based httpRequest only supports HTTP proxies.
				const url = this.getNodeParameter('url', i) as string;
				const method = this.getNodeParameter('method', i, 'GET') as IHttpRequestMethods;
				const connection = buildProxyConnection(gateway, { ...options, protocol: 'http' });

				const response = (await this.helpers.httpRequest({
					url,
					method,
					returnFullResponse: true,
					proxy: {
						host: connection.host,
						port: connection.port,
						auth: {
							username: connection.username,
							password: connection.password,
						},
					},
				})) as { statusCode: number; headers: IDataObject; body: IDataObject };

				returnData.push({
					json: {
						statusCode: response.statusCode,
						headers: response.headers,
						body: response.body,
					},
					pairedItem: { item: i },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
