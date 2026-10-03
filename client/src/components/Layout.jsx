import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth, ROLE_LABEL } from '../auth';
import { api, get } from '../api';
import { cx, dt } from './ui';

const NAV = {
  super_admin: [['/admin', 'Overview'], ['/admin/hospitals', 'Hospitals'], ['/admin/audit', 'Audit logs']],
  manager: [['/manager', 'Overview'], ['/manager/patients', 'Patients'], ['/manager/staff', 'Staff'], ['/manager/departments', 'Departments'], ['/manager/services', 'Services & prices'], ['/manager/payments', 'Payments'], ['/manager/reports', 'Reports'], ['/manager/audit', 'Audit logs']],
  cashier: [['/cashier', 'Overview'], ['/cashier/register', 'Register patient'], ['/cashier/patients', 'Find patient'], ['/cashier/visits', 'Today’s visits'], ['/cashier/pending', 'Pending payments'], ['/cashier/history', 'Payment history']],
  doctor: [['/doctor', 'My queue'], ['/doctor/patients', 'My patients'], ['/doctor/orders', 'Orders & results'], ['/doctor/follow-ups', 'Follow-ups']],
  lab: [['/laboratory', 'Lab requests']],
  xray: [['/xray', 'X-Ray requests']],
  pharmacist: [['/pharmacy', 'Prescriptions']],
};

function Bell() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate(); const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => get('/notifications'), refetchInterval: 20_000 });
  const readAll = async () => { await api.post('/notifications/read-all'); qc.invalidateQueries({ queryKey: ['notifications'] }); };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm" aria-label="Notifications">
        Notifications{data?.unread > 0 && <span className="ml-2 rounded-full bg-danger px-1.5 text-xs font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">Notifications<button className="text-xs font-medium text-brand" onClick={readAll}>Mark all read</button></div>
          <ul className="max-h-80 divide-y overflow-y-auto">
            {data?.items?.length ? data.items.map((n) => (
              <li key={n._id}><button className={cx('block w-full px-3 py-2 text-left text-sm hover:bg-slate-50', !n.read && 'bg-brand-tint')} onClick={async () => { await api.patch(`/notifications/${n._id}/read`); qc.invalidateQueries({ queryKey: ['notifications'] }); setOpen(false); n.link && nav(n.link); }}>
                {n.message}<span className="block text-xs text-slate-500">{dt(n.createdAt)}</span></button></li>
            )) : <li className="px-3 py-6 text-center text-sm text-slate-500">You’re all caught up.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, hospital, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen lg:flex">
      <aside className={cx('bg-ink text-slate-200 lg:block lg:w-60 lg:shrink-0', menu ? 'block' : 'hidden')}>
        <div className="border-b border-ink-line px-5 py-4"><div className="text-base font-bold text-white">{hospital?.name || 'HMS Platform'}</div><div className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</div></div>
        <nav className="space-y-0.5 p-3">
          {NAV[user.role].map(([to, label]) => (
            <NavLink key={to} to={to} end onClick={() => setMenu(false)} className={({ isActive }) => cx('block rounded-md px-3 py-2 text-sm font-medium', isActive ? 'bg-brand text-white' : 'hover:bg-ink-soft')}>{label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
          <button className="btn-ghost btn-sm lg:hidden" onClick={() => setMenu(!menu)}>Menu</button>
          <div className="hidden text-sm text-slate-500 lg:block">{new Date().toLocaleDateString([], { dateStyle: 'full' })}</div>
          <div className="flex items-center gap-3">
            {user.role !== 'super_admin' && <Bell />}
            <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
            <button className="btn-ghost btn-sm" onClick={logout}>Sign out</button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
