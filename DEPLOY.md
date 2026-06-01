# 🚀 Deploy Guide — DZ vs MA Rap Beef Tracker

## Files in this project

```
dzma-beef/
├── index.html          ← Public voting page (users see this)
├── style.css           ← All styles + animations
├── app.js              ← Frontend logic + Supabase voting
├── config.js           ← Your Supabase keys + admin password ← EDIT THIS
├── admin.html          ← Your private admin panel
├── supabase-setup.sql  ← Run once in Supabase to create the database
└── DEPLOY.md           ← This file
```

---

## STEP 1 — Create Supabase project (5 min)

1. Go to **supabase.com** → Sign up free
2. Click **New Project** → choose a name (e.g. `dzma-beef`) → set a DB password → click Create
3. Wait ~2 minutes for it to spin up
4. Go to **Settings → API** → copy:
   - `Project URL` (looks like `https://abcdef.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)

---

## STEP 2 — Create the database tables

1. In Supabase dashboard → click **SQL Editor** (left sidebar)
2. Click **New query**
3. Open the file `supabase-setup.sql` from this folder
4. Paste the entire contents into the SQL editor
5. Click **Run** (green button)
6. You should see "Success. No rows returned"
7. Go to **Table Editor** → you should now see `beefs` and `votes` tables with 3 seed beefs pre-loaded

---

## STEP 3 — Configure your keys

Open `config.js` and replace the placeholders:

```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const ADMIN_PASSWORD = 'choose-a-strong-password-here';
```

⚠️  The `ANON_KEY` is safe to expose in frontend code — it's public by design.
⚠️  Change `ADMIN_PASSWORD` to something only you know.

---

## STEP 4 — Enable Realtime (live vote updates)

1. In Supabase → **Database → Replication**
2. Find the `votes` table → toggle it ON
3. This makes vote counts update live for all viewers without refresh

---

## STEP 5 — Deploy to Vercel (free, ~2 min)

### Option A: Drag & Drop (easiest)

1. Go to **vercel.com** → sign up free (use GitHub)
2. Click **Add New → Project**
3. Choose **"Deploy without a Git repository"** or drag the `dzma-beef` folder
4. Click Deploy → done in 30 seconds
5. Your site is live at `https://dzma-beef.vercel.app` (or similar)

### Option B: GitHub + Vercel (best for updates)

1. Create a free GitHub account at github.com
2. Create a new repo (e.g. `dzma-beef`) → upload all files
3. Go to vercel.com → New Project → Import from GitHub → select your repo
4. Click Deploy
5. Every time you push to GitHub, Vercel auto-deploys in seconds

---

## STEP 6 — Access your admin panel

Your admin panel is at:
```
https://your-site.vercel.app/admin.html
```

- Enter the password you set in `config.js`
- Add beefs, edit them, delete them
- Users on the public site see changes instantly

**Keep this URL private** — it's protected only by the password.

---

## Optional: Custom domain

1. In Vercel → your project → **Settings → Domains**
2. Add your domain (e.g. `dzvsma.com`)
3. Follow the DNS instructions (takes ~10 min to propagate)
4. Namecheap/GoDaddy domains cost ~$10/year

---

## How voting works

- Each user gets a random anonymous ID stored in their browser (`localStorage`)
- Votes are stored in Supabase with a `UNIQUE(beef_id, voter_id)` constraint
- If a user clears their browser storage they could vote again — this is intentional for a fun fan site
- Votes update in realtime via Supabase's websocket channel

---

## Free tier limits (Supabase)

| Resource | Free limit | Your usage |
|---|---|---|
| Database rows | 500MB | ~1M votes easily |
| API requests | 5GB bandwidth/month | More than enough |
| Realtime connections | 200 concurrent | Fine for a fan site |
| Storage | 1GB | N/A |

You won't hit any limits for a fan site with normal traffic.

---

## Troubleshooting

**Votes not showing:** Check `config.js` has the correct URL and anon key.

**Admin login not working:** Make sure `config.js` is loaded before `admin.html` scripts.

**Realtime not working:** Enable the `votes` table in Supabase → Database → Replication.

**CORS errors:** Supabase allows all origins by default for anon key — if you see CORS errors, check your Supabase project is not paused (free tier pauses after 1 week of inactivity).
