# Smart-eTracking frontend

## Development

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

`127.0.0.1` is also allowed to access development resources. Restart the dev
server after changing `next.config.mjs`. Static export is enabled only outside
development to avoid the dev server's export-path check for encoded lot IDs;
production builds still generate every registered lot page.

## Build static files

From the `frontend` directory:

```bash
npm ci
npm run build
```

The deployable files are generated in **`frontend/out/`**, including `index.html`,
`404.html`, `_next/`, public images, and `lot/<siteId>/index.html` for each site in
`lib/mock-data.js`. Upload the entire contents of `out/` to your server's document
root (for example, `public_html/` on shared hosting). Keep the directory structure
and filenames intact, including spaces in lot directory names.

This configuration assumes hosting at the domain root, such as
`https://parking.example.com/`. It does not configure deployment under a subfolder.

Static export is enabled in `next.config.mjs`. Images are served as static assets,
and trailing slashes give each route its own directory and `index.html`.
No Next.js process is needed on the hosting server. `npm start` (`next start`)
is for server builds and must not be used to serve this static export.

To preview with Python 3 installed:

```bash
python3 -m http.server 3000 --directory out
```

Open http://localhost:3000 and test a lot link directly as well as by clicking
Proceed. Use HTTP rather than opening the HTML files using `file://`.

### Nginx example

After uploading `out/` contents into `/var/www/smart-etracking`:

```nginx
server {
    listen 80;
    server_name parking.example.com;
    root /var/www/smart-etracking;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    error_page 404 /404.html;
    location = /404.html {
        internal;
    }
}
```

Replace the domain and document root with your server values. Apache/shared
hosting should also serve directory `index.html` files; do not rewrite every
request to the home page.

### Rebuilding and troubleshooting

- Lot pages are generated from `SITES_REGISTRY` at build time. Rebuild and upload
  the export whenever you change site data or add a location. Unknown IDs return
  404.
- The layout uses `next/font/google`, so the build machine needs access to Google
  Fonts. Font files are included in the build for hosting.
- If a restricted build environment prevents Turbopack from binding its local
  worker port, use `npm run build -- --webpack`. This also generates `out/` and
  was used to verify the static export.
- Open the deployed domain before printing/downloading QR cards: the QR target
  uses the current browser origin.
- This exports only the frontend. Any backend service needs separate deployment.

See the [Next.js static export guide](https://nextjs.org/docs/app/guides/static-exports).
