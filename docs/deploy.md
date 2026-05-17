# Deployment

`public/` is the entire deployable artifact — no transpilation, no bundling, no runtime build step. Any static host that can serve a directory works. This document covers the two targets the project ships to today (GitHub Pages and an Aliyun OSS mirror for China-domestic users), plus notes on alternates.

## GitHub Pages (default, $0)

Live URL: <https://anois.github.io/photo-tools/>

The workflow file is [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). Every push to `main` triggers it — install deps → `npm run build` (regenerates `logos.json` + `fonts.css`) → upload `./public/` → publish. Manual re-runs are available via the **Actions** tab.

One-time repo setup:

1. **Settings → Pages → Source = GitHub Actions**

That's it. The workflow is otherwise self-contained.

## Other static hosts

Same idea — point them at `public/` after running `npm run build` locally or in CI.

| Host | Build command | Publish directory |
|---|---|---|
| Cloudflare Pages | `npm install && npm run build` | `public` |
| Netlify | `npm install && npm run build` | `public` |
| Vercel | `npm install && npm run build` | `public` |
| S3 + CloudFront | run `npm run build` in CI, sync `public/` to S3 | `public` |

The app has no runtime requirement on a particular host — no API routes, no edge functions, no env vars consumed at boot.

## China-domestic mirror via Aliyun OSS

GitHub Pages is intermittently slow or unreachable from mainland China. The same `public/` artifact is also synced to an Aliyun OSS bucket (mainland region, no ICP filing) as a domestic entry: <https://photo-tools.oss-cn-hangzhou.aliyuncs.com/>.

The `deploy-oss` job runs **in parallel** with the GitHub Pages job — a failure on one target doesn't block the other.

### One-time Aliyun setup

#### 1. Create the bucket

OSS Console → **Create Bucket**

- **Region**: `oss-cn-hangzhou` (or any mainland region)
- **ACL**: `public-read`
- Under **Static Website** settings, set default index document to `index.html`

#### 2. Create a RAM sub-user

Don't use root credentials for CI. RAM Console → Users → **Create user** `photo-tools-deploy`:

- Access type: **OpenAPI Access** (do NOT enable console login)
- Attach a custom policy scoped to the bucket only (least-privilege):

  ```json
  {
    "Version": "1",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:DeleteObject", "oss:GetObject", "oss:ListObjects"],
      "Resource": ["acs:oss:*:*:photo-tools", "acs:oss:*:*:photo-tools/*"]
    }]
  }
  ```

- Save the **AccessKey ID** and **AccessKey Secret** — the secret is shown only once.

#### 3. Add GitHub repo secrets

Settings → Secrets and variables → Actions → **Secrets** → New repository secret:

- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_OSS_BUCKET` = `photo-tools`
- `ALIYUN_OSS_ENDPOINT` = `oss-cn-hangzhou.aliyuncs.com`

#### 4. Enable the OSS deploy step

Settings → Secrets and variables → Actions → **Variables** → New repository variable:

- `ENABLE_OSS_DEPLOY` = `true`

The workflow checks this variable and skips the OSS job if it's missing or `false`. Useful to keep the OSS step opt-in across forks.

### Caveats with direct OSS URLs

Aliyun mainland-region direct OSS URLs (`*.oss-cn-<region>.aliyuncs.com`) sometimes display a security check page or get rate-limited when used as user-facing site endpoints, because the domain isn't ICP-filed. For low-volume personal use this typically works fine. If it triggers, fall back to:

| Option | Trade-off |
|---|---|
| **HK region** (`oss-cn-hongkong.aliyuncs.com`) | No filing, no security check; slightly slower (50–100 ms to mainland) |
| **Custom domain + Aliyun CDN** | Best long-term CN performance, but requires ICP filing (7–20 working days for individuals) |
| **Move to a different domestic CDN** | e.g. Cloudflare via custom CN POPs (paid), or a domestic provider with pre-filed shared domains |

## Custom domain

For GitHub Pages: Settings → Pages → **Custom domain**. Add a `CNAME` DNS record pointing your domain at `<username>.github.io`. The workflow already includes a `CNAME` file step that writes the domain into `public/CNAME` at publish time — adjust to your domain if forking.

For Aliyun OSS: bind a custom domain in the bucket → **Domain Names** panel, then point your DNS at the bucket. If you also want HTTPS, attach an SSL cert in OSS → Domain Names → HTTPS settings. (Both steps require ICP filing for mainland domains.)

## Local preview before deploy

```bash
npm run dev    # → http://localhost:3000
```

The dev server is just `serve public/` — what you see locally is what gets served in production. There are no environment-conditional code paths.

For a closer-to-production sanity check (precached service worker, fresh install state), open in an incognito window — the first load hits the network, the second load comes from the SW shell.
