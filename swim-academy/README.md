# Aqua Academy — Swimming Academy Manager (Prototype)

React + Vite + Dexie (IndexedDB) + Framer Motion. Mobile-first, all data stays in the browser. Same design and logins as the TT Academy project.

## Run
    npm install
    npm run dev      # dev server
    npm run build    # production build in dist/

## Demo logins (plain text, demo only)
| Role   | Username | Password  |
|--------|----------|-----------|
| Admin  | admin    | admin123  |
| Coach  | coach1   | coach123  |
| Parent | parent1  | parent123 |
(coach1-3, parent1-5 exist; swimmers have no login.)

## What works
- Landing page at `#/` (hero image, features, roles, IntersectionObserver scroll-reveal + count-up)
- Admin: Coaches, Parents, Swimmers, Batches (add/edit/delete + cascade rules), Attendance, Races, Fees, Settings
- Registration fee after adding a swimmer (Online or Offline); monthly dues auto-created; 1 / 6 / 12 month plans; parent due notices
- Races: pick event + up to 6 swimmers (lane order), live timer with per-lane Finish, auto ranking/medals, Undo/Reset, results board at `#/board/:id`
- Coach: own swimmers, attendance, notes, race timing for own swimmers
- Parent (read-only): child profile, races, medals, fees + online pay, attendance %, coach notes
- Settings: fee amounts, JSON export/import, reset demo data

## Notes
- Online payment is a simulated screen; real gateway needs a backend.
- IndexedDB is per-browser: use one device and switch roles to demo.
