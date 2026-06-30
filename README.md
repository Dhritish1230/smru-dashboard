# SMRU Internet Dashboard

This is a static web dashboard for the SMRU funnel and counselling data.

It reads live data from the Google Sheet:

- `LS_Funnel_Summary`
- `LS_Status_Summary`
- `LS_Student_Detail`

## Run locally

From this folder:

```powershell
python -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

If Python is not on PATH, use the bundled Python from Codex or any static file server.

## Deploy online

You can deploy this folder to:

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

Because the dashboard fetches Google Sheets CSV directly, the Google Sheet must be viewable by the dashboard user. Easiest setup:

1. Open the Google Sheet.
2. Click Share.
3. Set access to `Anyone with the link can view`.
4. Deploy this folder.

## Important

The dashboard contains student data. Keep the deployed link private or put it behind simple password protection if using Vercel/Netlify/Cloudflare.
