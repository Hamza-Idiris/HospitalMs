import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Table, Badge, Empty, Loading, Modal, Input, ErrorBox, dt, dateOnly } from '../components/ui';

const useSave = (fn, done) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { toast.success('Saved'); qc.invalidateQueries(); done?.(); }, onError: (e) => toast.error(errMsg(e)) });
};

export function Hospitals() {
  const { data, isLoading } = useQuery({ queryKey: ['hospitals'], queryFn: () => get('/hospitals') });
  const [form, setForm] = useState(null); const [mgr, setMgr] = useState(null);
  const toggle = useSave((h) => api.patch(`/hospitals/${h._id}/active`, { isActive: !h.isActive }));
  return (
    <>
      <PageHeader title="Hospitals" subtitle="Each hospital’s data is completely separate"><button className="btn-primary" onClick={() => setForm({})}>Create hospital</button></PageHeader>
      <Card>{isLoading ? <Loading /> : !data?.length ? <Empty>Create the first hospital and its manager.</Empty> : (
        <Table head={['Hospital', 'Code', 'Phone', 'Managers', 'Created', 'Status', '']}>{data.map((h) => <tr key={h._id}><td className="td font-medium">{h.name}<div className="text-xs text-slate-500">{h.address}</div></td><td className="td">{h.code}</td><td className="td">{h.phone}</td><td className="td">{h.managerCount}</td><td className="td">{dateOnly(h.createdAt)}</td><td className="td"><Badge value={h.isActive ? 'active' : 'inactive'} /></td>
          <td className="td flex flex-wrap justify-end gap-2"><button className="btn-ghost btn-sm" onClick={() => setForm(h)}>Edit</button><button className="btn-ghost btn-sm" onClick={() => setMgr(h)}>Add manager</button><button className="btn-ghost btn-sm" onClick={() => confirm(`${h.isActive ? 'Deactivate' : 'Activate'} ${h.name}?`) && toggle.mutate(h)}>{h.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</Table>
      )}</Card>
      {form && <HospitalForm hospital={form} onClose={() => setForm(null)} />}
      {mgr && <ManagerForm hospital={mgr} onClose={() => setMgr(null)} />}
    </>
  );
}
function HospitalForm({ hospital, onClose }) {
  const editing = !!hospital._id;
  const { register, handleSubmit } = useForm({ defaultValues: { ...hospital, requirePrepayment: hospital.settings?.requirePrepayment ?? true, cashierMaxDiscountPercent: hospital.settings?.cashierMaxDiscountPercent ?? 10, currency: hospital.settings?.currency || 'USD' } });
  const m = useSave((d) => {
    const body = { name: d.name, code: d.code, address: d.address, phone: d.phone, email: d.email || '', settings: { requirePrepayment: d.requirePrepayment, cashierMaxDiscountPercent: Number(d.cashierMaxDiscountPercent), currency: d.currency } };
    if (!editing) body.manager = { name: d.mName, email: d.mEmail, password: d.mPassword };
    return editing ? api.put(`/hospitals/${hospital._id}`, body) : api.post('/hospitals', body);
  }, onClose);
  return <Modal wide title={editing ? 'Edit hospital' : 'Create hospital'} onClose={onClose}><form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate(d))}>
    <div className="grid gap-4 sm:grid-cols-2"><Input label="Hospital name" reg={register('name', { required: true })} /><Input label="Short code" hint="Letters/numbers, e.g. ABC" reg={register('code', { required: true })} /><Input label="Address" reg={register('address')} /><Input label="Phone" reg={register('phone')} /><Input label="Email" type="email" reg={register('email')} /><Input label="Currency" reg={register('currency')} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('requirePrepayment')} /> Lab and X-Ray start only after payment</label><Input label="Max cashier discount (%)" type="number" min="0" max="100" reg={register('cashierMaxDiscountPercent')} /></div>
    {!editing && <div className="rounded-md bg-slate-50 p-4"><div className="mb-3 text-sm font-semibold">First hospital manager</div><div className="grid gap-4 sm:grid-cols-3"><Input label="Name" reg={register('mName', { required: true })} /><Input label="Email" type="email" reg={register('mEmail', { required: true })} /><Input label="Temporary password" type="password" reg={register('mPassword', { required: true, minLength: 8 })} /></div></div>}
    <ErrorBox error={m.error} /><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div></form></Modal>;
}
function ManagerForm({ hospital, onClose }) {
  const { register, handleSubmit } = useForm();
  const m = useSave((d) => api.post(`/hospitals/${hospital._id}/managers`, d), onClose);
  return <Modal title={`Add manager — ${hospital.name}`} onClose={onClose}><form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate(d))}><Input label="Name" reg={register('name', { required: true })} /><Input label="Email" type="email" reg={register('email', { required: true })} /><Input label="Temporary password" type="password" reg={register('password', { required: true, minLength: 8 })} /><ErrorBox error={m.error} /><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Create manager</button></div></form></Modal>;
}

export function AuditLogs() {
  const { user } = useAuth(); const [action, setAction] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['audit', action], queryFn: () => get('/audit-logs', { action }) });
  return (
    <>
      <PageHeader title="Audit logs" subtitle={user.role === 'super_admin' ? 'Activity across all hospitals' : 'Important actions in your hospital'} />
      <Card><input className="input mb-4 max-w-sm" placeholder="Filter by action, e.g. price, payment, discount" value={action} onChange={(e) => setAction(e.target.value)} />
        {isLoading ? <Loading /> : !data?.length ? <Empty>No activity matches.</Empty> : (
          <Table head={['When', 'User', 'Action', 'Details']}>{data.map((l) => <tr key={l._id}><td className="td whitespace-nowrap">{dt(l.createdAt)}</td><td className="td">{l.userName}<div className="text-xs text-slate-500">{l.role}</div></td><td className="td font-medium">{l.action}</td><td className="td max-w-xs break-words font-mono text-xs text-slate-600">{l.details ? JSON.stringify(l.details) : ''}</td></tr>)}</Table>
        )}</Card>
    </>
  );
}
