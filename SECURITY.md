# Security policy

## What this plugin touches

- It reads `https://status.opencode.ai/api/status` over HTTPS from the OpenCode server part. The
  endpoint is public and needs no key.
- It sends no credentials, no session content and no prompts. It has no account, no token and no
  configuration file with secrets.
- It stores display preferences in the app's plugin storage, under the plugin's own key.

A report that the plugin reads anything else, or sends data anywhere but the status endpoint, is a
security report.

## Reporting

Use GitHub's private vulnerability reporting on this repository:
<https://github.com/hamster007Github/OpenCodeStatusPlugin/security/advisories/new>. Do not open a
public issue for a vulnerability.

Include the plugin version, the OpenCode version, the operating system and what you observed. Never
include API keys, session content or credentials.

## Scope

- The upstream status payload is untrusted input. A response that the plugin cannot parse must
  degrade to `unknown`; a response that could render as healthy while it is not is a bug worth
  reporting here.
- The plugin's `apiUrl` option exists for a local mirror. Plain HTTP is accepted only for
  `localhost` and `127.0.0.1`.
- Vulnerabilities in OpenCode itself belong to the OpenCode project, not to this plugin.
