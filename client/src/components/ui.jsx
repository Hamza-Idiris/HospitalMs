import { useEffect } from 'react';

export const cx = (...a) => a.filter(Boolean).join(' ');
export const money = (n, cur = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n || 0);
export const dt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString([], { dateStyle: 'medium' }) : '—');
export const human = (s) => String(s || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const TONES = {
  waiting: 'bg-amber-100 text-amber-800', in_consultation: 'bg-sky-100 text-sky-800', completed: 'bg-emerald-100 text-emerald-800',
  referred: 'bg-violet-100 text-violet-800', follow_up: 'bg-indigo-100 text-indigo-800',
  pending: 'bg-amber-100 text-amber-800', partial: 'bg-orange-100 text-orange-800', paid: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-slate-200 text-slate-700', refunded: 'bg-rose-100 text-rose-800',
  requested: 'bg-slate-100 text-slate-700', pending_payment: 'bg-amber-100 text-amber-800', in_progress: 'bg-sky-100 text-sky-800',
  dispensed: 'bg-emerald-100 text-emerald-800', active: 'bg-emerald-100 text-emerald-800', inactive: 'bg-slate-200 text-slate-700',
  high: 'bg-rose-100 text-rose-800', low: 'bg-sky-100 text-sky-800', abnormal: 'bg-rose-100 text-rose-800', normal: 'bg-emerald-100 text-emerald-800',
};
export const Badge = ({ value, label }) => <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[value] || 'bg-slate-100 text-slate-700')}>{label || human(value)}</span>;

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-xl font-bold">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);
export const Card = ({ title, actions, children, className }) => (
  <section className={cx('rounded-lg border border-slate-200 bg-white', className)}>
    {(title || actions) && <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2><div>{actions}</div></header>}
    <div className="p-4">{children}</div>
  </section>
);
export const Stat = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-2xl font-bold tabular-nums">{value ?? 0}</div><div className="mt-1 text-sm text-slate-500">{label}</div></div>
);
export const Empty = ({ children = 'Nothing here yet.' }) => <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
export const Loading = () => <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
export const ErrorBox = ({ error }) => error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-danger">{error?.response?.data?.message || error.message}</p> : null;

export function Table({ head, children, empty }) {
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-slate-200"><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody></table>{empty}</div>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('w-full rounded-lg bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h2 className="font-semibold">{title}</h2><button className="text-slate-400 hover:text-ink" onClick={onClose} aria-label="Close">✕</button></header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export const Field = ({ label, error, children, hint }) => (
  <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}{error && <span className="mt-1 block text-xs text-danger">{error.message || error}</span>}</label>
);
export const Input = ({ label, error, hint, reg, ...p }) => <Field label={label} error={error} hint={hint}><input className="input" {...(reg || {})} {...p} /></Field>;
export const Textarea = ({ label, error, reg, rows = 3, ...p }) => <Field label={label} error={error}><textarea rows={rows} className="input" {...(reg || {})} {...p} /></Field>;
export const Select = ({ label, error, reg, children, ...p }) => <Field label={label} error={error}><select className="input" {...(reg || {})} {...p}>{children}</select></Field>;

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
    {tabs.map(([k, l]) => <button key={k} onClick={() => onChange(k)} className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', value === k ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-ink')}>{l}</button>)}
  </div>
);
