# Standalone plan editor

`editor.html` is a web-only editor that makes the floor-plan JSON. It has no native
connections: each lamp and AC can be given a Home Assistant entity ID by hand, either in
its inspector or in the **Bindings** dialog. Deploy it as plain static files on your own
server.

## Build

```bash
cd web
npm ci
npm run build:editor
```

The build writes `dist-editor/`:

```
dist-editor/
  editor.html
  assets/            hashed JS and CSS
  plans/home.json    demo plan loaded by default
  plans/studio.json  demo with rounded rooms
  plans/house.json   two-floor demo with a rounded room
```

The panel build (`npm run build`) is separate and unchanged.

## Deploy

Upload the **contents** of `dist-editor/` to your web server, for example `/var/www/house-editor`.
The editor uses relative URLs, so it works at the root or in a subfolder.

Open:

```
https://your-server/editor.html
https://your-server/house-editor/editor.html
```

Serve it over HTTP(S); ES modules do not run from `file://`.

Nginx:

```nginx
server {
    listen 443 ssl;
    server_name house.example.com;
    root /var/www/house-editor;
    index editor.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Apache:

```apache
<VirtualHost *:443>
    ServerName house.example.com
    DocumentRoot /var/www/house-editor
    DirectoryIndex editor.html
    <Directory /var/www/house-editor>
        Require all granted
    </Directory>
</VirtualHost>
```

The default MIME types on both servers already send `.js` as `text/javascript` and
`.json` as `application/json`.

## Plans and demos

- Default: `plans/home.json`.
- Open another demo with `?plan=studio` or `?plan=house`.
- Use **Import…** for a plan from disk, and **Download JSON** to save your own.
- To make your own plan the default, replace `plans/home.json` in the deployed folder.
- The demo plans already contain rounded rooms (living/kitchen in `home`, the studio's west
  side, the house study); corners can also be edited from the room inspector.

## Home Assistant entity IDs

Select a lamp or AC, then paste its entity ID under **Home Assistant**, or open
**Bindings** in the sidebar to paste them all in one dialog. Copy the ID in Home Assistant
from **Settings → Devices & services → Entities**, **Developer Tools → States**, or an
entity's More info → gear → Entity ID.

The editor does not check that an entity exists; the Home Assistant card does that later.
Leave the field empty for a simulated device.

## Local check

```bash
npm run dev:editor      # http://localhost:5200/editor.html
npm run build:editor
npm run preview:editor  # serves dist-editor
```
