/* Landing.jsx — public marketing page shown at '/#/' (hero, stats, features, roles, scroll-reveal animation). */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Waves, IndianRupee, CalendarCheck, ShieldCheck, HeartHandshake, Timer, Tv, NotebookPen, DatabaseBackup, Smartphone, Layers, ArrowRight, Trophy } from 'lucide-react';
import { Num, useAuth, LangSwitch, Brand } from './ui';
import { t } from './i18n';
import { T } from './pages';
import hero from './assets/hero.svg';
import lockup from './assets/lockup.png';

// IntersectionObserver hook: flips to true the first time the element scrolls into view.
function useIn(th = .2) {
    const r = useRef(null), [v, setV] = useState(false);
    useEffect(() => { const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect() } }, { threshold: th }); o.observe(r.current); return () => o.disconnect() }, []);
    return [r, v];
}
const Reveal = ({ children, d = 0, className = '' }) => { const [r, v] = useIn(); return <div ref={r} className={`rv ${v ? 'in' : ''} ${className}`} style={{ '--d': `${d}ms` }}>{children}</div> };
const Stat = ({ v, l }) => { const [r, on] = useIn(.5); return <div ref={r} className="lp-stat"><b>{on ? <Num v={v} /> : '0'}</b><small>{t(l)}</small></div> };

const LN = [['Rohan Das', 3000], ['Ananya Mehta', 3600], ['Meera Joshi', 4300]];
function MiniTimer() {
    const [r, on] = useIn(.4), [ms, setMs] = useState(0);
    useEffect(() => { if (!on) return; const id = setInterval(() => setMs(x => x > 6500 ? 0 : x + 60), 60); return () => clearInterval(id) }, [on]);
    return <div ref={r} className="lp-board"><span className="live"><i />{t('LIVE')} · Best of 3 Games Singles</span><div className="rc sm2">{T(Math.min(ms, 4300) * 8)}</div>
        {LN.map(([n, f], i) => <div key={n} className="lp-pl"><span>L{i + 1} · {n}</span>{ms >= f ? <motion.b initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{['🥇', '🥈', '🥉'][LN.filter(x => ms >= x[1]).findIndex(x => x[0] === n)]} {T(f * 8)}</motion.b> : <small>{t('Playing…')}</small>}</div>)}
        <small>{t('Start · Finish tap · Undo. Ranking is automatic.')}</small></div>;
}

const F = [
    [ShieldCheck, 'Role-based dashboards', 'Separate logins for admin, coach and parent. Players have no login.'],
    [Users, 'Coaches, players, parents', 'Add, edit and delete everything in one place.'],
    [Layers, 'Batches & courts', 'Assign players to coaches, batches and parents.'],
    [CalendarCheck, 'Attendance', 'Mark Present, Absent or Late in one tap.'],
    [Waves, 'Matches & meets', 'Schedule events with up to 6 courts.'],
    [Timer, 'Live match timer', 'Start the clock, tap Finish per court. Rank is automatic.'],
    [Trophy, 'Tournaments', 'Create tournaments, auto-generate heats, track medals and points.'],
    [Tv, 'Live results board', 'Big dark board for the deck or TV.'],
    [IndianRupee, 'Fees & payments', 'Registration and monthly fees, 6-month or 1-year plans, online or offline.'],
    [HeartHandshake, 'Parent portal', 'Schedule, matches, medals, fees and notes. View only.'],
    [NotebookPen, 'Coach notes', 'Technique feedback that parents can read.'],
    [DatabaseBackup, 'Offline + backup', 'All data stays in the browser, with JSON backup.'],
    [Smartphone, 'Mobile-first design', 'Bottom navigation, bottom sheets and smooth animations.'],
];
const ROLES = [['Admin', 'Runs the whole academy', 'Coaches, players, batches, matches, live timing, fees and leaderboard.'], ['Coach', 'Looks after own players', 'Attendance, notes and match timing for own players.'], ['Parent', 'Keeps an eye on the child', 'Schedule, fees, attendance, medals and live matches, view only.']];

export default function Landing() {
    const { u } = useAuth(), [solid, setSolid] = useState(false), sen = useRef(null);
    useEffect(() => { const o = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting)); o.observe(sen.current); return () => o.disconnect() }, []);
    const go = u ? `/${u.role}` : '/login';
    return <div className="lp"><div ref={sen} className="lp-sen" />
        <nav className={`lp-nav ${solid ? 'solid' : ''}`}><div className="lp-logo"><Brand /></div>
            <a href="#features" className="lp-lnk">{t('Features')}</a><a href="#roles" className="lp-lnk">{t('Roles')}</a><LangSwitch />
            <Link className="btn lime sm" to={go}>{u ? t('Open dashboard') : t('Login')}</Link></nav>
        <header className="lp-hero">
            <div className="lp-copy"><small className="lp-tag">{t('Make every athlete visible')}</small>
                <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}>{t('Run your badminton academy from one phone.')}</motion.h1>
                <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .12 }}>{t('Players, coaches, parents, batches, fees and live matches in one simple system. Works offline and feels best on mobile.')}</motion.p>
                <motion.div className="lp-cta" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6, delay: .24 }}>
                    <Link className="btn lime" to={go}>{u ? t('Open dashboard') : t('Try the live demo')} <ArrowRight size={18} /></Link>
                    <a className="btn ghostd" href="#features">{t('See all features')}</a></motion.div></div>
            <motion.div className="lp-img" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7, delay: .2 }}>
                <img src={hero} alt="Badminton courts with players and a stopwatch" /><motion.div className="lp-chip" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}><span className="live"><i />{t('LIVE')}</span> Best of 3 Games Free · 0:31.42</motion.div></motion.div>
        </header>
        <section className="lp-stats"><Stat v={13} l="Core features" /><Stat v={3} l="Role logins" /><Stat v={6} l="Lanes per match" /><Stat v={100} l="% offline in browser" /></section>
        <section id="features" className="lp-sec"><Reveal><h2>{t('Everything the academy needs')}</h2><p className="mut">{t('Every feature runs on real data in the demo.')}</p></Reveal>
            <div className="lp-grid">{F.map(([I, ti, d], i) => <Reveal key={ti} d={(i % 3) * 90} className="lp-card"><div className="lp-ic"><I size={22} /></div><h3>{t(ti)}</h3><p>{t(d)}</p></Reveal>)}</div></section>
        <section className="lp-sec lp-split"><Reveal><h2>{t('Live match timing, zero paperwork')}</h2><p className="mut">{t('The coach taps Start, then Finish as each player touches the wall. Times, ranks and medals are automatic.')}</p><Link className="btn sm" to={go}>{t('Time a match')}</Link></Reveal>
            <Reveal d={120}><MiniTimer /></Reveal></section>
        <section id="roles" className="lp-sec"><Reveal><h2>{t('One system, three views')}</h2></Reveal>
            <div className="lp-grid r3">{ROLES.map(([ro, s, d], i) => <Reveal key={ro} d={i * 110} className="lp-card"><small>{t(ro)}</small><h3>{t(s)}</h3><p>{t(d)}</p></Reveal>)}</div></section>
        <Reveal className="lp-end"><h2>{t('Ready to see the demo?')}</h2><p>admin / admin123 · coach1 / coach123 · parent1 / parent123</p><Link className="btn lime sm" to={go}>{u ? t('Open dashboard') : t('Login now')}</Link></Reveal>
        <Reveal className="lp-brand"><img src={lockup} alt="Stadia — Make every athlete visible" /></Reveal>
        <footer className="lp-foot">{t('Demo prototype · Data stays in your browser')}</footer></div>;
}
