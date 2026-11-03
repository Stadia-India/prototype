# Developer notes

The original table-tennis app has been retained. New files are not required for the two additions: `Performance` and `Tournaments` are exported from `src/pages.jsx`, routes/navigation are wired in `src/App.jsx`, and their IndexedDB stores are introduced in Dexie schema v2 in `src/db.js`.

Performance records store playerId, coachId, date, five 1–5 skill scores, and free-text feedback. Tournament records store name, event, category, start/end dates, venue, status and optional winnerId.
