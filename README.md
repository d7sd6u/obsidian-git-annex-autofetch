# git-annex autofetch

_Do you know what git-annex is? If not, you should definitely check [this](https://github.com/d7sd6u/obsidian-lazy-cached-vault-load?tab=readme-ov-file#wait-a-minute-what-are-folderindex-notes-what-are-ftags-what-do-you-mean-annexed) out._

Seamlessly view, preview, embed (in notes and in Canvas), download and share files (images, videos, PDFs, archives and any other filetypes) that are not present in the current git-annex repository. Works on mobile and on desktop.

## Patches

### View

https://github.com/user-attachments/assets/45fa88e6-d3a2-4f40-a03e-1f9b5503dfd9

### Preview

https://github.com/user-attachments/assets/8bdb4bdb-b3bb-4558-8af8-92aa9b5bb8d0

### Embed

https://github.com/user-attachments/assets/5194ef8b-56fb-4545-b632-8179d7616a44

### Download

https://github.com/user-attachments/assets/5dc53184-0631-42ea-b2c6-dafe46f4b97d

### Share

https://github.com/user-attachments/assets/1a4867ca-7005-4dad-8e4e-496ba37254fb

## Setup

For this plugin to work you have to have a web server serving your `.git/annex/objects` folder. This server has to serve your repository that has all the annexed files that you want to be available from Obsidian - so most of the time it is the repository that has every file.

Additionally, you can setup an image optimizer service that would compress and re-scale images before serving them.

Also you have to enter the template for blob urls, one specifically for compressed (or uncompressed) images and one for intact blobs.

On Linux with bind-fs, Docker and Traefik this is how it could be hosted:

`/etc/fstab`:

```
/home/user/Vault /home/user/server/vault-mirror fuse.bindfs nofail,perms=a+r:a-w,resolve-symlinks 0 2
```

`~/server/docker-compose.yml`:

```yaml
version: "3.8"
services:
    vault-static:
        image: flashspys/nginx-static
        restart: always
        networks:
            - proxy
            - default
        volumes:
            - ./vault-mirror/.git/annex/objects:/static/
        labels:
            - "traefik.enable=true"
            - "traefik.http.services.vault-static.loadbalancer.server.port=80"
            - "traefik.http.routers.vaultstatic.rule=Host(`vaultstatic.your.host`) && PathPrefix(`/raw/secret/`)"
            - "traefik.http.routers.vaultstatic.middlewares=stripauth-static,allowcorsall"
            - "traefik.http.middlewares.stripauth-static.stripprefix.prefixes=/raw/secret"
            - "traefik.http.middlewares.allowcorsall.headers.accesscontrolalloworiginlist=*"
    vault-optimiser:
        image: h2non/imaginary
        restart: always
        networks:
            - proxy
            - default
        command: -enable-url-source -allowed-origins http://vault-static -http-cache-ttl 31556926
        labels:
            - "traefik.enable=true"
            - "traefik.http.services.vault-optimiser.loadbalancer.server.port=9000"
            - "traefik.http.routers.vault-optimiser.rule=Host(`vaultstatic.your.host`) && PathPrefix(`/secret/`)"
            - "traefik.http.routers.vault-optimiser.middlewares=stripauth-optimiser,allowcorsall"
            - "traefik.http.middlewares.stripauth-optimiser.stripprefix.prefixes=/secret"
networks:
    default:
        external: false
    proxy:
        external: true
```

Then the templates would be:

```
https://vaultstatic.your.host/secret/resize?width=300&url=http://vault-static/{{{objectpath}}}
https://vaultstatic.your.host/raw/secret/{{{objectpath}}}
```

## Limitations

Currently it has to download PDF files on mobile for them to work. Sharing also requires downloading the shared file.

## Workflows

As git-annex is cumbersome on Android phones, instead of Termux+git-annex I use the following setup:

(Desktop) main git-annex repo <-> (Desktop) mobile-mirror git-annex repo <-> (Mobile) Syncthing sync folder

Syncthing syncs git-annex pointers just fine, so everything works out of the box. There are a few downsides however, downloaded files are synced from your phone to the mirror (so, double the bandwidth usage) and present files are duplicated on your desktop (so, double the storage usage for files that are present on your phone).

## Network use

This plugin only makes HTTP(S) requests using the templates provided in the settings tab of the plugin. No default templates are provided, thus no network requests are made before the user sets the settings.

## Other plugins

- [auto-folder-note-paste](https://github.com/d7sd6u/obsidian-auto-folder-note-paste) - makes sure your attachments are "inside" your note on paste and drag'n'drop by making your note a folder note
- [folders-graph](https://github.com/d7sd6u/obsidian-folders-graph) - adds folders as nodes to graph views
- [reveal-folded](https://github.com/d7sd6u/obsidian-reveal-folded) - reveal current file in file explorer while collapsing everything else
- [hide-index-files](https://github.com/d7sd6u/obsidian-hide-index-files) - hide folder notes (index files) from file explorer
- [crosslink-advanced](https://github.com/d7sd6u/obsidian-crosslink-advanced) - adds commands to deal with [ftags](https://github.com/d7sd6u/obsidian-lazy-cached-vault-load?tab=readme-ov-file#wait-a-minute-what-are-folderindex-notes-what-are-ftags-what-do-you-mean-annexed)-oriented vaults: add ftags, create child note, open random unftagged file, etc.
- [virtual-dirs](https://github.com/d7sd6u/obsidian-virtual-dirs) - adds "virtual" folder files / folder indexes. You can open them, you can search for them, but they do not take space and "materialise" whenever you want a _real_ folder note
- [viewer-ftags](https://github.com/d7sd6u/obsidian-viewer-ftags) - add ftags as chips on top of markdown/file editors/previews. And children as differently styled chips too!

## Contributing

Issues and patches are welcome. This plugin is intended to be used with other plugins and I would try to do my best to support this use case, but I retain the right to refuse supporting any given plugin for arbitrary reasons.
