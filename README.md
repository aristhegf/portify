# Portify

Portify is a free, open-source web tool for viewing and interacting with websites in a real remote desktop browser viewport from a phone.

## Current status

Early prototype using Cloudflare Browser Run. The home page starts a remote Chromium session and opens Cloudflare Live View inside Portify's own viewer. The viewer has an in-page landscape control that rotates the viewing surface for a wider working area without requiring the user to rotate the physical phone. An Open-in-new-tab fallback is available because some pages or hosted viewers may refuse to render inside an iframe.

## Stack

- TypeScript and Cloudflare Workers
- Cloudflare Browser Run for remote Chromium sessions
- Plain HTML, CSS, and JavaScript for a lightweight interface

## Local development

Requirements: Node.js 20+ and a Cloudflare account with Browser Run enabled.

```sh
npm install
npx wrangler dev
```

Configure the Browser Run binding in `wrangler.toml`. Local development may require Cloudflare's remote browser binding to be enabled for your account.

Deploy after logging in to Wrangler:

```sh
npx wrangler login
npm run deploy
```

## Current limitations

- Browser Run's free allowance is limited; this is a personal-use prototype.
- The landscape control rotates the viewer in the page; it cannot force iOS to change the phone's physical orientation.
- Live View is Cloudflare's hosted interface embedded in an iframe, not a custom-built streaming client. If embedding is blocked, use the open-in-new-tab control.
- Before public launch, add abuse prevention, per-session ownership, rate limits, stronger URL/destination restrictions, and billing/usage controls.
- This project is not yet ready for untrusted public traffic.

## License

MIT
