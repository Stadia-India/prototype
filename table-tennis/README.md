# STADIA Table Tennis Academy

A React + Vite + Dexie academy management prototype with Admin, Coach and Parent areas.

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## Performance functionality

- Admin and coaches can record player assessments for footwork, forehand, backhand, serve and fitness (ratings 1–5), with assessment date and coach feedback.
- The Performance page shows assessment history and a selectable player trend chart.
- Parent Progress shows only the linked child's performance trend, latest skill ratings, assessment history, attendance and coach notes.
- Performance records are stored locally in the Dexie `performance` table (database schema version 2).

## Branding

The dashboard uses the supplied STADIA logo and mark with the navy/red/white brand palette.

## Demo accounts

- Admin: `admin` / `admin123`
- Coaches: `coach1`, `coach2`, `coach3` / `coach123`
- Parents: `parent1` through `parent5` / `parent123`

This is a local prototype. Authentication and demo payments are not production-secure/payment processing.
