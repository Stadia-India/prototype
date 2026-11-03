/* =====================================================================
   perf.jsx  —  PERFORMANCE feature (admin · coach · parent)
   ---------------------------------------------------------------------
   WHAT IT DOES
   Shows one player's times for one event as a LINE CHART (Recharts) and
   lets the right people RECORD new times.

   WHO CAN DO WHAT  (see canManage below)
     admin  -> view every player, ADD / EDIT / DELETE performance for anyone
     coach  -> view own players, ADD / EDIT / DELETE for own players only
     parent -> VIEW ONLY (their selected child). No add button is shown.

   WHERE THE DATA COMES FROM  (two sources are merged into one line)
     1. db.results      -> times from completed matches (source = 'match')
     2. db.performance  -> times typed in by coach/admin (source = 'training')

   FLOW
     useLiveQuery (auto-refresh on any DB change)
       -> merge both sources into `rows`
       -> keep the selected player + selected event => `pts` (sorted by date)
       -> stat cards, chart `data`, log list
     "+" button -> bottom sheet form -> validate -> db.performance.add/update
     -> useLiveQuery fires again -> chart redraws automatically.
   ===================================================================== */
import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { db, today } from './db';
import { t, lang } from './i18n';
import { useAuth, useToast, Sheet, Confirm, Avatar, Badge, Num, Empty, useLookups } from './ui';
import { T, EVENTS } from './pages';   // T = format ms as m:ss.cc, EVENTS = list of match events

/* ---------- small helpers ---------- */
const LOC = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', kn: 'kn-IN' };                       // language -> date locale
const dShort = ts => new Date(ts).toLocaleDateString(LOC[lang()], { day: 'numeric', month: 'short' });               // "12 Oct"
const dLong = ts => new Date(ts).toLocaleDateString(LOC[lang()], { day: 'numeric', month: 'short', year: 'numeric' }); // "12 Oct 2026"
const ft = ms => ms >= 6e4 ? T(ms) : (ms / 1000).toFixed(1) + 's';       // short axis label: "32.4s" (or m:ss.cc over a minute)
const dayTs = s => new Date(String(s).slice(0, 10) + 'T00:00:00').getTime();  // 'YYYY-MM-DD...' -> timestamp of that day (chart X value)
const medal = p => ['🥇', '🥈', '🥉'][p - 1] || `#${p}`;              // match place -> emoji
const toMs = (m, s, c) => ((m * 60 + s) * 100 + c) * 10;                    // minutes + seconds + hundredths -> milliseconds
const split = ms => { const cs = Math.round(ms / 10); return { m: Math.floor(cs / 6000), s: Math.floor(cs / 100) % 60, c: cs % 100 } }; // ms -> {m,s,c} for the edit form

/* ---------- PERMISSION RULE (the single place that decides "who can give performance") ----------
   admin -> always.  coach -> only if the player is assigned to this coach.  parent -> never.   */
export const canManage = (role, u, sw) => !!sw && (role === 'admin' || (role === 'coach' && sw.coachId === u.refId));

/* =====================================================================
   LINE CHART  (Recharts)
   data = [{x:dayTimestamp, ts:exactTimestamp, you:timeMs, avg:academyAverageMs}]
   - YAxis is `reversed`: smaller time (= faster) is drawn HIGHER, so improvement
     looks like the line going UP.
   - Solid red line = the player, dashed grey line = academy average that day.
   - Green ring "PB" = the player's personal best.
   - Clicking a point calls onSel(index) so the page can show that entry's details.
   ===================================================================== */
export function LineChartR({ data, name, sel, onSel }) {
    const pb = data.reduce((a, p) => p.you < a.you ? p : a, data[0]);       // fastest point
    const hasAvg = data.some(d => d.avg != null);                     // draw the dashed line only if we have average data
    // Custom tooltip box (shown on hover / tap)
    const tip = ({ active, payload }) => active && payload?.length ? <div className="ctip"><b>{T(payload[0].payload.you)}</b><small>{dLong(payload[0].payload.ts)}</small></div> : null;
    return <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 18, right: 14, left: 0, bottom: 4 }} onClick={e => e?.activeTooltipIndex != null && onSel(e.activeTooltipIndex)}>
            <CartesianGrid stroke="#ECEAF3" vertical={false} />
            {/* X = date. type=number + scale=time spaces points by real time gaps, not equally */}
            <XAxis dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={dShort} tick={{ fontSize: 11, fill: '#7A7799' }} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} />
            {/* Y = time. reversed => fast on top. ±1.5 s padding so the line never touches the edge */}
            <YAxis reversed domain={['dataMin - 1500', 'dataMax + 1500']} tickFormatter={ft} tick={{ fontSize: 11, fill: '#7A7799' }} tickLine={false} axisLine={false} width={48} tickCount={5} />
            <Tooltip content={tip} />
            {hasAvg && <Line type="monotone" dataKey="avg" name={t('Academy average')} stroke="#8d8aa8" strokeWidth={2} strokeDasharray="6 6" dot={false} animationDuration={900} />}
            {/* Main line. Custom dot: the selected point is filled red + bigger */}
            <Line type="monotone" dataKey="you" name={name} stroke="#E6192D" strokeWidth={3.5} animationDuration={900}
                dot={p => <circle key={p.index} cx={p.cx} cy={p.cy} r={p.index === sel ? 6 : 4} fill={p.index === sel ? '#E6192D' : '#fff'} stroke={p.index === sel ? '#fff' : '#E6192D'} strokeWidth={2.5} />}
                activeDot={{ r: 7, fill: '#E6192D', stroke: '#fff', strokeWidth: 2 }} />
            {/* Personal-best marker */}
            <ReferenceDot x={pb.x} y={pb.you} r={10} fill="none" stroke="#2DD4BF" strokeWidth={2.5} label={{ value: 'PB', position: 'top', fill: '#0b8c80', fontSize: 11, fontWeight: 800 }} />
        </LineChart>
    </ResponsiveContainer>;
}

/* =====================================================================
   PERFORMANCE PAGE
   role = 'admin' | 'coach' | 'parent'  (passed from the route in App.jsx)
   ===================================================================== */
export function Performance({ role }) {
    const { u } = useAuth(), ctx = useOutletContext() || {}, lk = useLookups(), toast = useToast();
    // Live data. useLiveQuery re-runs automatically whenever these tables change.
    const matches = useLiveQuery(() => db.matches.toArray(), []) || [];
    const rl = useLiveQuery(() => db.results.toArray(), []) || [];
    const pf = useLiveQuery(() => db.performance.toArray(), []) || [];
    // UI state: chosen player id, chosen event, selected chart point, add/edit form, delete target, form error
    const [sid, setSid] = useState(''), [evSel, setEv] = useState(''), [selI, setSelI] = useState(null);
    const [f, setF] = useState(null), [err, setErr] = useState(''), [del, setDel] = useState(null);

    // Which players appear in the dropdown: admin = all, coach = own only, parent = none (uses the child switcher)
    const list = role === 'admin' ? lk.players : role === 'coach' ? lk.players.filter(p => p.coachId === u.refId) : [];

    // STEP 1 — merge the two sources into one list of rows with the same shape.
    const rmap = useMemo(() => Object.fromEntries(matches.filter(r => r.status === 'completed').map(r => [r.id, r])), [matches]);
    const rows = useMemo(() => [
        // a) completed match results
        ...rl.filter(x => rmap[x.matchId]).map(x => { const r = rmap[x.matchId]; return { key: 'r' + x.id, src: 'match', playerId: x.playerId, event: r.event, timeMs: x.timeMs, place: x.place, ts: new Date(r.scheduledAt).getTime(), x: dayTs(r.scheduledAt) } }),
        // b) performance entries typed in by coach/admin (stored with a date only, so we use 12:00 as the time)
        ...pf.map(x => ({ key: 'p' + x.id, src: 'training', id: x.id, playerId: x.playerId, event: x.event, timeMs: x.timeMs, date: x.date, note: x.note, ts: dayTs(x.date) + 432e5, x: dayTs(x.date) })),
    ], [rl, rmap, pf]);

    // STEP 2 — pick the player to show (first one that has data, if none chosen yet)
    const hasData = new Set(rows.map(r => r.playerId));
    const sw = role === 'parent' ? ctx.kid : (list.find(p => p.id === +sid) || list.find(p => hasData.has(p.id)) || list[0]);
    if (!sw) return <div className="page"><div className="bar"><h2>{t('Performance')}</h2></div><Empty t={role === 'parent' ? 'No child is linked to this login' : 'Nothing here yet'} /></div>;
    const manage = canManage(role, u, sw);                          // may the current user add/edit for this player?

    // STEP 3 — this player's rows, their events (most-used first) and the selected event's points
    const mine = rows.filter(r => r.playerId === sw.id).sort((a, b) => a.ts - b.ts);
    const cnt = {}; mine.forEach(r => cnt[r.event] = (cnt[r.event] || 0) + 1);
    const evs = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]), ev = evs.includes(evSel) ? evSel : evs[0];
    const pts = mine.filter(r => r.event === ev), n = pts.length;

    // STEP 4 — academy average per day for this event (everyone's rows, grouped by day)
    const avg = {}; rows.filter(r => r.event === ev).forEach(r => { (avg[r.x] || (avg[r.x] = [])).push(r.timeMs) });
    const am = Object.fromEntries(Object.entries(avg).map(([x, a]) => [x, a.reduce((s, v) => s + v, 0) / a.length]));
    const multiAvg = Object.keys(am).length > 1;

    // STEP 5 — numbers for the stat cards
    const first = pts[0], last = pts[n - 1], best = n ? Math.min(...pts.map(p => p.timeMs)) : 0;
    const imp = n > 1 ? (first.timeMs - last.timeMs) / first.timeMs * 100 : 0;   // + = faster than the first time
    const sel = selI != null && selI < n ? selI : n - 1, sp = pts[sel];             // selected point (default = latest)
    const data = pts.map(p => ({ x: p.x, ts: p.ts, you: p.timeMs, avg: multiAvg ? am[p.x] : undefined }));  // what the chart draws

    /* ---------- ADD / EDIT / DELETE (admin + coach only) ---------- */
    const setV = (k, v) => setF(s => ({ ...s, v: { ...s.v, [k]: v } }));
    const openAdd = () => { setErr(''); setF({ v: { playerId: sw.id, event: ev || EVENTS[0], date: today(), m: '0', s: '', c: '0', note: '' } }) };
    const openEdit = r => { setErr(''); const x = split(r.timeMs); setF({ id: r.id, v: { playerId: r.playerId, event: r.event, date: r.date, m: String(x.m), s: String(x.s), c: String(x.c), note: r.note || '' } }) };
    const save = async () => {
        const v = f.v, target = lk.by.players[+v.playerId];
        // 1. permission check (also protects against a hand-edited form)
        if (!canManage(role, u, target)) return setErr(t('Only the admin or the player’s coach can add performance'));
        // 2. validate the time: seconds required, 0-59 s, 0-99 hundredths, total must be > 0
        const m = +v.m || 0, s = +v.s || 0, c = +v.c || 0;
        if (v.s === '' || s > 59 || m < 0 || s < 0 || c < 0 || c > 99 || toMs(m, s, c) <= 0) return setErr(t('Enter a valid time'));
        // 3. validate the date: required and not in the future
        if (!v.event || !v.date) return setErr(t('Event and date are required'));
        if (v.date > today()) return setErr(t('Date cannot be in the future'));
        // 4. save (update if editing, add if new)
        const rec = { playerId: target.id, event: v.event, date: v.date, timeMs: toMs(m, s, c), note: v.note.trim(), coachId: role === 'coach' ? u.refId : (target.coachId ?? null), by: role };
        f.id ? await db.performance.update(f.id, rec) : await db.performance.add(rec);
        // 5. jump the page to what was just saved, close the sheet, show a toast
        setSid(String(target.id)); setEv(v.event); setSelI(null); setF(null); toast(f.id ? 'Updated ✓' : 'Added ✓');
    };

    /* ---------- RENDER ---------- */
    return <div className="page"><div className="bar"><h2>{t('Performance')}</h2></div>
        {/* Header: parent sees a hero card for the child; admin/coach get a player dropdown */}
        {role === 'parent' ? <motion.div className="hero kid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}><Avatar n={sw.name} id={sw.id} /><div><h1>{sw.name}</h1><small>{t(sw.level)} · {t(sw.stroke || '')} · {sw.age} {t('yrs')}</small></div></motion.div>
            : <label className="fld"><span>{t('Select player')}</span><select value={sw.id} onChange={e => { setSid(e.target.value); setEv(''); setSelI(null) }}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}

        {!n ? <Empty t="No performance recorded yet" /> : <>
            {/* Event chips */}
            <div className="chips">{evs.map(e => <button key={e} className={e === ev ? 'chip on' : 'chip'} onClick={() => { setEv(e); setSelI(null) }}>{e}</button>)}</div>
            {/* Four stat cards: PB, latest, number of entries, improvement % (green = faster, red = slower) */}
            <div className="grid">
                <div className="stat v"><small>{t('Personal best')}</small><b>{T(best)}</b></div>
                <div className="stat"><small>{t('Latest')}</small><b>{T(last.timeMs)}</b></div>
                <div className="stat"><small>{t('Entries')}</small><b><Num v={n} /></b></div>
                <div className="stat"><small>{t('Improvement')}</small><b style={{ color: imp >= 0 ? '#0b8c80' : 'var(--coral)' }}>{imp >= 0 ? '+' : '−'}{Math.abs(imp).toFixed(1)}%</b></div></div>
            {/* Chart card */}
            <div className="card">
                <div className="lgd"><span><i className="k1" />{sw.name.split(' ')[0]}</span>{multiAvg && <span><i className="k2" />{t('Academy average')}</span>}</div>
                {n > 1 ? <LineChartR key={`${sw.id}-${ev}`} data={data} name={sw.name.split(' ')[0]} sel={sel} onSel={setSelI} />
                    : <p className="mut">{t('Add one more time to see the line.')}</p>}
                <small className="mut">{t('Faster times appear higher. Tap the chart to see a match.')}</small>
                {/* Details of the selected point */}
                <div className="row seld"><b className="md">{sp.src === 'match' ? medal(sp.place) : '🏊'}</b><div className="grow"><b>{T(sp.timeMs)}</b><small>{dLong(sp.ts)} · {sp.event}</small></div>{sp.timeMs === best && <Badge t="PB" c="active" />}</div>
                {role === 'parent' && <small className="mut" style={{ marginTop: 8 }}>{t('Performance is recorded by the coach or admin. You can view it here.')}</small>}
            </div>
            {/* Log: newest first, with change vs the previous entry. Only 'training' rows can be edited/deleted; match rows are read-only */}
            <h3>{t('Performance log')}</h3>
            <div className="list">{pts.slice(-8).reverse().map((p, i) => {
                const prev = pts[n - 1 - i - 1], d = prev ? (p.timeMs - prev.timeMs) / 1000 : null;
                return <motion.div key={p.key} className="card row" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .04 }}>
                    <b className="md">{p.src === 'match' ? medal(p.place) : '🏊'}</b>
                    <div className="grow"><b>{T(p.timeMs)}</b><small>{dLong(p.ts)} · {t(p.src === 'match' ? 'Match' : 'Training')}{p.note ? ` · ${p.note}` : ''}</small></div>
                    {d != null && <Badge t={`${d <= 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}s`} c={d <= 0 ? 'active' : 'advanced'} />}
                    {manage && p.src === 'training' && <div className="acts"><button className="ib" onClick={() => openEdit(p)}><Pencil size={16} /></button><button className="ib red" onClick={() => setDel(p)}><Trash2 size={16} /></button></div>}
                </motion.div>
            })}</div></>}

        {/* "+" button: only admin and coach (parent never sees it) */}
        {role !== 'parent' && <motion.button whileTap={{ scale: .9 }} className="fab" aria-label={t('Add performance')} onClick={openAdd}><Plus /></motion.button>}

        {/* Add / Edit form (bottom sheet) */}
        <Sheet open={!!f} onClose={() => setF(null)} title={t(f?.id ? 'Edit performance' : 'Add performance')}>
            {f && <>
                <label className="fld"><span>{t('Player')} *</span><select value={f.v.playerId} onChange={e => setV('playerId', e.target.value)}>{list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                <label className="fld"><span>{t('Event')} *</span><select value={f.v.event} onChange={e => setV('event', e.target.value)}>{EVENTS.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
                <label className="fld"><span>{t('Date')} *</span><input type="date" max={today()} value={f.v.date} onChange={e => setV('date', e.target.value)} /></label>
                {/* Time is typed in three boxes so nobody has to type "0:32.45" correctly */}
                <div className="two">
                    <label className="fld"><span>{t('Minutes')}</span><input type="number" inputMode="numeric" min="0" value={f.v.m} onChange={e => setV('m', e.target.value)} /></label>
                    <label className="fld"><span>{t('Seconds')} *</span><input type="number" inputMode="numeric" min="0" max="59" value={f.v.s} onChange={e => setV('s', e.target.value)} /></label>
                    <label className="fld"><span>{t('Hundredths')}</span><input type="number" inputMode="numeric" min="0" max="99" value={f.v.c} onChange={e => setV('c', e.target.value)} /></label></div>
                <label className="fld"><span>{t('Note (optional)')}</span><input value={f.v.note} onChange={e => setV('note', e.target.value)} /></label>
                {err && <p className="err">{err}</p>}
                <button className="btn" onClick={save}>{t('Save')}</button></>}
        </Sheet>
        <Confirm msg={del && 'This performance entry will be deleted.'} onClose={() => setDel(null)} onYes={async () => { await db.performance.delete(del.id); setSelI(null) }} />
    </div>;
}
