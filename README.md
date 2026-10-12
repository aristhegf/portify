# Portify

Portify is a free, open-source web tool for viewing and interacting with websites in a real remote desktop browser viewport from a phone.

## Current status

Early prototype. The first milestone is validating remote desktop browsing with Cloudflare Browser Run's interactive Live View.

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
- Live View opens in a separate browser tab, because it is hosted by Cloudflare.
- Before public launch, add abuse prevention, per-session ownership, rate limits, stronger URL/destination restrictions, and billing/usage controls.
- This project is not yet ready for untrusted public traffic.

## License

MIT
