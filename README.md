# Guardian Lookup

A Destiny 2 website with two parts:

- **Vault** (the home page): sign in with Bungie to see every weapon and piece of
  armor in your vault and on your characters, and move or equip them.
  Also: Postmaster (see and pull items), loadouts (saved in your browser),
  compare copies side by side, smart search filters, and community god-roll
  highlights from the DIM "voltron" wish list.
- **Player lookup**: search any player by Bungie Name to see their characters,
  loadout, recent activity and career stats.

Your keys live only on the server (in Vercel's settings), never in the page.

## What's in here

```
public/index.html      The website itself
api/index.js           The one server function; sends each /api/... request to routes/
vercel.json            Points every /api/... address at api/index.js
routes/auth/login.js      Sends you to Bungie.net to sign in
routes/auth/callback.js   Bungie sends you back here after sign-in
routes/auth/logout.js     Signs you out
routes/me.js              Who's signed in
routes/inventory.js       Your vault and character inventories
routes/transfer.js        Moves, equips, locks, pulls from Postmaster, equips loadouts
routes/item.js            One item's stats, perks and mods
routes/wishlist.js        Community god rolls for your weapons
routes/search.js          Finds a player by Bungie Name
routes/profile.js         Characters, gear, clan, title, Guardian Rank
routes/activities.js      Recent activity for a character
routes/stats.js           Career stats
routes/items.js           Item, stat, title and activity names and icons
lib/bungie.js          Shared code that talks to Bungie (adds your API key)
lib/session.js         Keeps you signed in (encrypted cookie, no database)
dev-server.js          Runs everything on your computer for testing
```

## Settings in Vercel

Project → Settings → Environment Variables:

| Name | Where to find it |
|---|---|
| `BUNGIE_API_KEY` | bungie.net/en/Application → your app → API Key |
| `BUNGIE_CLIENT_ID` | same page → OAuth client_id |
| `BUNGIE_CLIENT_SECRET` | same page → OAuth client_secret |

After adding or changing a variable, redeploy (Deployments → ⋯ → Redeploy).

## Settings on your Bungie app (for the Vault)

At bungie.net/en/Application, open your app and set:

1. **OAuth Client Type**: Confidential
2. **Redirect URL**: `https://YOUR-SITE.vercel.app/api/auth/callback`
   (use your real Vercel address)
3. **Scope**: tick
   - Read your Destiny 2 information (Vault, Inventory, and Vendors)…
   - Move or equip Destiny gear and other items.
4. Save, then copy the **OAuth client_id** and **OAuth client_secret** into Vercel.

## Try it on your computer (optional)

Requires Node.js 18 or newer. Player lookup works locally; Vault sign-in only
works on your deployed https site, because Bungie sends players back to the
Redirect URL you registered.

Mac/Linux:
```
BUNGIE_API_KEY=your_key node dev-server.js
```
Windows (PowerShell):
```
$env:BUNGIE_API_KEY="your_key"; node dev-server.js
```
Open http://localhost:3000

## Search filters (Vault)

Combine any of these, and put `-` in front to exclude:

- `is:exotic` `is:legendary` `is:weapon` `is:armor` `is:arc` `is:solar` `is:void`
  `is:stasis` `is:strand` `is:kinetic` `is:masterwork` `is:crafted` `is:locked`
  `is:equipped` `is:vault` `is:dupe` `is:godroll` `is:helmet` `is:gauntlets`
  `is:chest` `is:legs` `is:classitem` `is:titan` `is:hunter` `is:warlock`
- `perk:outlaw` (any perk or mod; use `_` for spaces, like `perk:kill_clip`)
- `stat:health>=25`, `stat:total>=60`, `stat:range>70`
- `power>2000`
- plain words match names and types, like `hand cannon`

## God rolls

The server downloads the community wish list once (about 28 MB) and keeps it in
memory. To use a different list, set `WISHLIST_URL` in Vercel to its raw URL.
A weapon gets a thumbs-up when its active perks match a recommended roll.

## Good to know

- Equipped items can't be moved. Equip something else in that slot first.
- Moving between characters goes through the vault (Bungie's rule), so it's two
  steps behind the scenes. If the second step fails, the item stays in your vault.
- Bungie may refuse an equip while you're in certain activities, or if it would
  mean two Exotics. The site shows Bungie's reason.
- Each character can hold 9 items per slot, so make room before moving more in.
- Loadouts are saved in your browser, so they don't follow you to another device.
- Applying a loadout moves each item to the character, then equips them all at once.

## Troubleshooting

- **Deploy fails with "No more than 12 Serverless Functions"**: keep handlers in
  `routes/` and only `index.js` in `api/` (Vercel's free plan counts each file in `api/`).

- **"Sign-in isn't set up yet"**: add `BUNGIE_CLIENT_ID` and `BUNGIE_CLIENT_SECRET` in Vercel and redeploy.
- **Bungie shows an error about the redirect**: the Redirect URL on your Bungie app must match your site address exactly, ending in `/api/auth/callback`.
- **"The server is missing its BUNGIE_API_KEY setting"**: add it in Vercel and redeploy.
- **"No player found"**: check the spelling and the 4-digit code.
- **"Bungie.net is down for maintenance"**: wait for Bungie's maintenance to end.
