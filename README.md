# Guardian Lookup

A Destiny 2 website: search any player by Bungie Name and see their characters,
equipped weapons and armor, and career stats (PvE, raids, dungeons, Crucible, Trials).

Your Bungie API key lives only on the server (in Vercel's settings), never in the page.

## What's in here

```
public/index.html   The website itself
api/search.js       Finds a player by Bungie Name
api/profile.js      Characters and equipped gear
api/items.js        Item names, icons and rarity
api/stats.js        Career stats
lib/bungie.js       Shared code that talks to Bungie (adds your API key)
dev-server.js       Runs everything on your computer for testing
```

## 1. Get a Bungie API key

1. Sign in at https://www.bungie.net/en/Application and click **Create New App**.
2. Fill in a name and your website.
3. **OAuth Client Type**: Not applicable.
4. **Origin Header**: leave blank (the browser never talks to Bungie directly).
5. Agree to the terms and create it. Copy the **API Key**.

## 2. Try it on your computer (optional)

Requires Node.js 18 or newer (https://nodejs.org).

Mac/Linux:
```
BUNGIE_API_KEY=your_key node dev-server.js
```
Windows (PowerShell):
```
$env:BUNGIE_API_KEY="your_key"; node dev-server.js
```
Open http://localhost:3000

## 3. Put it online with Vercel

1. Create a free GitHub account if you don't have one, and a new repository.
   Upload all the files in this folder to it (keep the folders as they are).
2. Sign in at https://vercel.com with GitHub and click **Add New → Project**.
3. Import your repository. Leave the Framework Preset as **Other**.
4. Open **Environment Variables** and add:
   - Name: `BUNGIE_API_KEY`
   - Value: your API key
5. Click **Deploy**. You'll get a link like `guardian-lookup.vercel.app`.

Every time you push a change to GitHub, Vercel redeploys automatically.
If you change the API key later, redeploy so the new value takes effect.

## Sharing a lookup

After a search, the address bar updates to something like
`?name=Name%231234`. Send that link and it opens straight to that player.

## Troubleshooting

- **"The server is missing its BUNGIE_API_KEY setting"**: the environment
  variable isn't set in Vercel, or you haven't redeployed since adding it.
- **"No player found"**: check the spelling and the 4-digit code.
- **Gear missing**: the player has hidden their inventory in their privacy settings.
- **"Bungie.net is down for maintenance"**: wait for Bungie's maintenance to end.
