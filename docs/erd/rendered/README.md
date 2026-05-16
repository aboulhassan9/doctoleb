# Rendered ERD Figures

These SVG files are generated from the curated `docs/erd/views/10-*.dbml`
through `docs/erd/views/19-*.dbml` files for graduation documentation and
handoff reviews.

Regenerate after ERD source changes:

```bash
npm run render:erd-views
```

Use one SVG per report figure so each data-model section stays readable.
