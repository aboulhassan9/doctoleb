# ChartDB Import Files

Use these `.chartdb.json` files when you want the clean visual canvas in
ChartDB: real Areas, sticky Notes, and pre-arranged tables.

Import path in ChartDB:

1. Open **Backup**.
2. Choose **Restore Diagram** / **Import Diagram**.
3. Select one `.chartdb.json` file from this folder.

Use the matching `.dbml` in `docs/erd/views/` as the source-of-truth text file.
DBML notes and `TableGroup` blocks are useful for documentation, but ChartDB
does not turn them into visible canvas Areas/Notes during DBML import.

If the left **Areas** panel is empty, the wrong file was imported. Delete that
diagram and import the `.chartdb.json` backup file instead.

Why this folder exists:

- ChartDB DBML import strips `TableGroup` blocks.
- ChartDB DBML import strips top-level `Note` blocks.
- ChartDB backup JSON supports native `areas` and `notes`.
- The JSON files are generated from the DBML, so do not hand-edit them.
