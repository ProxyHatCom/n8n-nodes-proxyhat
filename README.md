# n8n-nodes-proxyhat

Route your [n8n](https://n8n.io) workflows through [ProxyHat](https://proxyhat.com?utm_source=github&utm_medium=readme&utm_campaign=n8n) residential proxies — rotating IPs, geo-targeting, and sticky sessions, no code.

[![CI](https://github.com/ProxyHatCom/n8n-nodes-proxyhat/actions/workflows/ci.yml/badge.svg)](https://github.com/ProxyHatCom/n8n-nodes-proxyhat/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/n8n-nodes-proxyhat)](https://www.npmjs.com/package/n8n-nodes-proxyhat)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

This is a community node package for n8n. It adds a **ProxyHat** node that gives your automations residential IPs from 148+ countries, so scraping and API calls don't get blocked or rate-limited from n8n's own datacenter IP.

> [!TIP]
> **Recommended proxies — [ProxyHat](https://proxyhat.com?utm_source=github&utm_medium=readme&utm_campaign=n8n&utm_content=callout) residential IPs.** Every feature in this package is tested end-to-end against ProxyHat and works great. First-class integration; also works with any proxy, or none.


## Why

n8n runs from a fixed server IP. Hit any site that geo-restricts or rate-limits and your workflow stalls. This node plugs ProxyHat's residential IPs (50M+ across 148+ countries) into n8n: build a gateway URL for a downstream **HTTP Request** node, or fetch a URL directly through the proxy — with per-country/region/city targeting and optional sticky sessions.

## Install

In n8n: **Settings → Community Nodes → Install**, then enter `n8n-nodes-proxyhat`.

Self-hosted from the CLI:

```bash
npm install n8n-nodes-proxyhat
```

Community nodes require a self-hosted n8n instance (or n8n Cloud with community nodes enabled).

## Credentials

Create a **ProxyHat API** credential. Two ways to authenticate:

| Field | Notes |
|---|---|
| **API Key** | Your ProxyHat account API key. Auto-selects an active sub-user with remaining traffic. |
| **Sub-User** | Optional. Pin a specific sub-user by name or UUID (with an API key). |
| **Gateway Username / Password** | A sub-user's `proxy_username` / `proxy_password` — skips the account API. |

Get an API key at [proxyhat.com](https://proxyhat.com?utm_source=github&utm_medium=readme&utm_campaign=n8n).

## Operations

### Get Proxy URL

Builds a ready-to-use ProxyHat gateway URL from your credential and targeting, and outputs it (plus split `host` / `port` / `username` / `password`). Wire it into an **HTTP Request** node's proxy setting to send that request through a residential IP.

Output:

```json
{
  "proxyUrl": "http://user-country-us:pass@gate.proxyhat.com:8080",
  "protocol": "http",
  "host": "gate.proxyhat.com",
  "port": 8080,
  "username": "user-country-us",
  "password": "pass"
}
```

Protocol can be `http` (port 8080) or `socks5` (port 1080).

### Fetch URL

Fetches a URL directly through the residential proxy (HTTP gateway) and returns the response:

```json
{
  "statusCode": 200,
  "headers": { "content-type": "application/json" },
  "body": { "origin": "203.0.113.7" }
}
```

Set the URL and method (GET / HEAD / POST / PUT / DELETE) on the node.

## Targeting & sticky sessions

Both operations expose the same targeting parameters:

| Parameter | Example | Effect |
|---|---|---|
| **Country** | `us` | ISO country code to exit from. Blank = any. |
| **Region** | `california` | State / region slug. |
| **City** | `new_york` | City slug. |
| **IP Quality Filter** | `high` | AI IP-quality / speed tier. |
| **Sticky Session** | on | Keep one residential IP instead of rotating a fresh one each request. |
| **Sticky TTL** | `30m` | How long to hold the sticky IP (`30m`, `12h`, …). |

By default every execution gets a **fresh rotating IP**. Turn **Sticky Session** on to pin one IP for the TTL — useful for multi-step flows against the same site.

## How it works

The node resolves your gateway credentials once (via the official [`proxyhat`](https://www.npmjs.com/package/proxyhat) SDK — an API key auto-picks an active sub-user), then builds a gateway URL per item with ProxyHat's targeting grammar. **Get Proxy URL** hands that URL to a downstream HTTP Request node; **Fetch URL** routes the request through the gateway itself using n8n's built-in HTTP helper. URL building is fully offline; the only network call is the one-time sub-user lookup when you authenticate with an API key.

## License

MIT © [ProxyHat](https://proxyhat.com?utm_source=github&utm_medium=readme&utm_campaign=n8n)
