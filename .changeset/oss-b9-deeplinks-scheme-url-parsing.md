---
"@flare-engine/deep-links": patch
---

deep-links: correct custom-scheme URL parsing.

`parseUrl` treated the first token after `://` as the host for every scheme, so an RN-style deep link like `myapp://zone/4` parsed to host `zone` + segments `['4']` and could never match a `/zone/:id` route (`DeepLinkRouter.match` routes on segments only). Now only `http`/`https` extract an authority into `host`; any other scheme yields `host = ''` and treats the entire post-`://` remainder as the path, so `myapp://zone/4` → segments `['zone','4']` and matches `/zone/:id`.

Also: a scheme-detection guard prevents a `://` inside a query value (e.g. `/redirect?to=http://x.com`) from being misread as a scheme; the `http`/`https` authority now stops at the first `/`, `?`, or `#` (a query-only universal link no longer folds its query into `host`). `host` is documented as tri-state — real authority (http/https) · `''` (custom scheme, no authority) · `null` (relative URL).

Behavior change: custom-scheme route patterns must now account for the segment that was previously swallowed as host (e.g. register `/settings/profile`, not `/profile`, for `myapp://settings/profile`). The README example and 2-arg `DeepLinkManager` construction snippet are corrected.
