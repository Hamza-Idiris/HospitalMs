import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { useAuth, ROLE_LABEL } from '../auth';
import { PageHeader, Card, Table, Badge, Empty, Loading, Modal, Input, Select, ErrorBox, Stat, money, dt, human } from '../components/ui';

const useSave = (fn, done) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => { toast.success('Saved'); qc.invalidateQueries(); done?.(); }, onError: (e) => toast.error(errMsg(e)) });
};

/* ---------- Departments ---------- */
export function Departments() {
  const { data, isLoading } = useQuery({ queryKey: ['departments', 'all'], queryFn: () => get('/departments') });
  const [edit, setEdit] = useState(null);
  const toggle = useSave((d) => api.put(`/departments/${d._id}`, { isActive: !d.isActive }));
  return (
    <>
      <PageHeader title="Departments"><button className="btn-primary" onClick={() => setEdit({})}>Add department</button></PageHeader>
      <Card>{isLoading ? <Loading /> : !data?.length ? <Empty>Add your first department.</Empty> : (
        <Table head={['Name', 'Description', 'Status', '']}>{data.map((d) => <tr key={d._id}><td className="td font-medium">{d.name}</td><td className="td">{d.description}</td><td className="td"><Badge value={d.isActive ? 'active' : 'inactive'} /></td>
          <td className="td flex justify-end gap-2"><button className="btn-ghost btn-sm" onClick={() => setEdit(d)}>Edit</button><button className="btn-ghost btn-sm" onClick={() => toggle.mutate(d)}>{d.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</Table>
      )}</Card>
      {edit && <DeptForm dept={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function DeptForm({ dept, onClose }) {
  const { register, handleSubmit } = useForm({ defaultValues: dept });
  const m = useSave((d) => (dept._id ? api.put(`/departments/${dept._id}`, d) : api.post('/departments', d)), onClose);
  return <Modal title={dept._id ? 'Edit department' : 'Add department'} onClose={onClose}><form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate({ name: d.name, description: d.description }))}>
    <Input label="Name" reg={register('name', { required: true })} /><Input label="Description" reg={register('description')} /><ErrorBox error={m.error} />
    <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div></form></Modal>;
}

/* ---------- Staff ---------- */
export function Staff() {
  const { data, isLoading } = useQuery({ queryKey: ['staff'], queryFn: () => get('/users') });
  const [edit, setEdit] = useState(null); const [reset, setReset] = useState(null);
  const toggle = useSave((u) => api.patch(`/users/${u._id}/active`, { isActive: !u.isActive }));
  return (
    <>
      <PageHeader title="Staff accounts" subtitle="Doctors, reception, cashiers, laboratory, X-Ray and pharmacy"><button className="btn-primary" onClick={() => setEdit({})}>Add staff member</button></PageHeader>
      <Card>{isLoading ? <Loading /> : !data?.length ? <Empty>No staff accounts yet.</Empty> : (
        <Table head={['Name', 'Role', 'Email', 'Department', 'Status', '']}>{data.map((u) => <tr key={u._id}><td className="td font-medium">{u.name}</td><td className="td">{ROLE_LABEL[u.role]}</td><td className="td">{u.email}</td><td className="td">{u.departmentId?.name || '—'}</td><td className="td"><Badge value={u.isActive ? 'active' : 'inactive'} /></td>
          <td className="td flex justify-end gap-2"><button className="btn-ghost btn-sm" onClick={() => setEdit(u)}>Edit</button><button className="btn-ghost btn-sm" onClick={() => setReset(u)}>Reset password</button><button className="btn-ghost btn-sm" onClick={() => toggle.mutate(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</Table>
      )}</Card>
      {edit && <StaffForm user={edit} onClose={() => setEdit(null)} />}
      {reset && <ResetPw user={reset} onClose={() => setReset(null)} />}
    </>
  );
}
function StaffForm({ user, onClose }) {
  const depts = useQuery({ queryKey: ['departments'], queryFn: () => get('/departments', { active: 'true' }) });
  const { register, handleSubmit, watch } = useForm({ defaultValues: { ...user, departmentId: user.departmentId?._id || '', role: user.role || 'cashier' } });
  const m = useSave((d) => (user._id ? api.put(`/users/${user._id}`, d) : api.post('/users', d)), onClose);
  const role = watch('role');
  return <Modal title={user._id ? 'Edit staff member' : 'Add staff member'} onClose={onClose}><form className="space-y-4" onSubmit={handleSubmit((d) => { const { password, ...rest } = d; m.mutate(user._id ? rest : d); })}>
    <Input label="Full name" reg={register('name', { required: true })} /><Input label="Email" type="email" reg={register('email', { required: true })} /><Input label="Phone" reg={register('phone')} />
    <Select label="Role" reg={register('role')}>{['cashier', 'doctor', 'lab', 'xray', 'pharmacist'].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
    {role === 'doctor' && <><Select label="Department" reg={register('departmentId')}><option value="">None</option>{depts.data?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</Select><Input label="Specialty" reg={register('specialty')} /></>}
    {!user._id && <Input label="Temporary password" type="password" hint="At least 8 characters" reg={register('password', { required: true, minLength: 8 })} />}
    <ErrorBox error={m.error} /><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div></form></Modal>;
}
function ResetPw({ user, onClose }) {
  const { register, handleSubmit } = useForm();
  const m = useSave((d) => api.post(`/users/${user._id}/reset-password`, d), onClose);
  return <Modal title={`Reset password — ${user.name}`} onClose={onClose}><form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate(d))}><Input label="New password" type="password" reg={register('password', { required: true, minLength: 8 })} /><ErrorBox error={m.error} /><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Reset password</button></div></form></Modal>;
}

/* ---------- Services & pricing ---------- */
export function Services() {
  const { hospital } = useAuth(); const cur = hospital?.settings?.currency || 'USD';
  const { data, isLoading } = useQuery({ queryKey: ['services', 'all'], queryFn: () => get('/services') });
  const [edit, setEdit] = useState(null);
  const toggle = useSave((s) => api.put(`/services/${s._id}`, { isActive: !s.isActive }));
  return (
    <>
      <PageHeader title="Services & prices" subtitle="Changing a price only affects new charges. Past payments keep the price they were paid at."><button className="btn-primary" onClick={() => setEdit({})}>Add service</button></PageHeader>
      <Card>{isLoading ? <Loading /> : !data?.length ? <Empty>Add services such as Consultation, CBC or Chest X-Ray.</Empty> : (
        <Table head={['Service', 'Category', 'Price', 'Status', '']}>{data.map((s) => <tr key={s._id}><td className="td font-medium">{s.name}</td><td className="td">{human(s.category)}</td><td className="td">{money(s.price, cur)}</td><td className="td"><Badge value={s.isActive ? 'active' : 'inactive'} /></td>
          <td className="td flex justify-end gap-2"><button className="btn-ghost btn-sm" onClick={() => setEdit(s)}>Edit</button><button className="btn-ghost btn-sm" onClick={() => toggle.mutate(s)}>{s.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</Table>
      )}</Card>
      {edit && <ServiceForm service={edit} cur={cur} onClose={() => setEdit(null)} />}
    </>
  );
}
function ServiceForm({ service, cur, onClose }) {
  const { register, handleSubmit } = useForm({ defaultValues: { category: 'laboratory', ...service } });
  const m = useSave((d) => (service._id ? api.put(`/services/${service._id}`, d) : api.post('/services', d)), onClose);
  return <Modal title={service._id ? 'Edit service' : 'Add service'} onClose={onClose}><form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate({ name: d.name, category: d.category, price: Number(d.price) }))}>
    <Input label="Name" reg={register('name', { required: true })} />
    <Select label="Category" reg={register('category')}><option value="registration">Registration</option><option value="consultation">Consultation (charged when a visit is created)</option><option value="laboratory">Laboratory</option><option value="xray">X-Ray / imaging</option><option value="other">Other</option></Select>
    <Input label={`Price (${cur})`} type="number" step="0.01" min="0" reg={register('price', { required: true })} />
    {service.priceHistory?.length > 1 && <div className="rounded-md bg-slate-50 p-3 text-xs"><b>Price history</b><ul className="mt-1 space-y-0.5">{[...service.priceHistory].reverse().map((h, i) => <li key={i}>{money(h.price, cur)} — {dt(h.at)}</li>)}</ul></div>}
    <ErrorBox error={m.error} /><div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div></form></Modal>;
}

/* ---------- Reports ---------- */
const Bars = ({ rows, label, value, fmt = (v) => v }) => {
  const max = Math.max(...rows.map((r) => r[value]), 1);
  return rows.length ? <ul className="space-y-1.5">{rows.map((r) => <li key={r[label] ?? 'x'} className="grid grid-cols-[8rem_1fr_5rem] items-center gap-2 text-sm"><span className="truncate">{human(r[label] || 'Unspecified')}</span><span className="h-3 rounded bg-slate-100"><span className="block h-3 rounded bg-brand" style={{ width: `${(r[value] / max) * 100}%` }} /></span><span className="text-right tabular-nums">{fmt(r[value])}</span></li>)}</ul> : <Empty>No data in this period.</Empty>;
};
export function Reports() {
  const { hospital } = useAuth(); const cur = hospital?.settings?.currency || 'USD'; const f = (v) => money(v, cur);
  const today = new Date().toISOString().slice(0, 10); const ago = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const [range, setRange] = useState({ from: ago, to: today });
  const { data, isLoading } = useQuery({ queryKey: ['reports', range], queryFn: () => get('/reports/summary', range) });
  const status = (arr) => (arr || []).map((x) => ({ _id: x._id, count: x.count }));
  return (
    <>
      <PageHeader title="Reports"><input type="date" className="input w-auto" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="From" /><input type="date" className="input w-auto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="To" /></PageHeader>
      {isLoading ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Revenue collected" value={f(data.totalRevenue)} /><Stat label="Discounts given" value={f(data.discounts.total)} /><Stat label="Outstanding balances" value={f(data.outstanding.total)} /><Stat label="New / returning visits" value={`${data.newVsReturning.newVisits} / ${data.newVsReturning.returning}`} /></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Revenue by day"><Bars rows={data.revenueByDay} label="_id" value="total" fmt={f} /></Card>
            <Card title="Revenue by service type"><Bars rows={data.revenueByCategory} label="_id" value="total" fmt={f} /></Card>
            <Card title="Revenue by service"><Bars rows={data.revenueByService} label="_id" value="total" fmt={f} /></Card>
            <Card title="Patients by department (visits)"><Bars rows={data.visitsByDept} label="name" value="count" /></Card>
            <Card title="Daily registrations"><Bars rows={data.registrations} label="_id" value="count" /></Card>
            <Card title="Cashier transactions"><Bars rows={data.cashiers} label="name" value="total" fmt={f} /></Card>
            <Card title="Laboratory orders"><Bars rows={status(data.lab)} label="_id" value="count" /></Card>
            <Card title="X-Ray orders"><Bars rows={status(data.xray)} label="_id" value="count" /></Card>
            <Card title="Prescriptions"><Bars rows={status(data.pharmacy)} label="_id" value="count" /></Card>
          </div>
        </div>
      )}
    </>
  );
}
