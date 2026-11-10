---
'@flare-engine/shapes': patch
---

Internal refactor: the triangle, ngon, star, arc, trapezoid and path renderers now share one module-private fill-then-stroke helper instead of six copies of the same block. Draw output and exports are unchanged.
