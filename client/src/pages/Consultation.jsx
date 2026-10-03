import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Badge, Input, Textarea, Select, Loading, Empty, ErrorBox, Tabs, dt } from '../components/ui';
import { LabResultView, XrayReportView } from '../components/ResultViews';

const VITALS = [['bp', 'Blood pressure', 'text'], ['temperature', 'Temp (°C)', 'number'], ['pulse', 'Pulse (bpm)', 'number'], ['respiratoryRate', 'Resp. rate', 'number'], ['spo2', 'SpO₂ (%)', 'number'], ['weight', 'Weight (kg)', 'number'], ['height', 'Height (cm)', 'number']];

function ConsultForm({ visit, consultation }) {
  const qc = useQueryClient(); const nav = useNavigate();
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => {
    const c = consultation || {};
    reset({ ...c, followUpDate: c.followUpDate ? c.followUpDate.slice(0, 10) : '', vitals: { bp: '', ...(c.vitals || {}) } });
  }, [consultation, reset]);
  const m = useMutation({
    mutationFn: ({ d, complete }) => {
      const vitals = Object.fromEntries(Object.entries(d.vitals || {}).filter(([, v]) => v !== '' && v != null && !Number.isNaN(v)));
      const { _id, hospitalId, visit: v, patient, doctor, createdAt, updatedAt, __v, completed, ...rest } = d;
      return api.put(`/consultations/visit/${visit._id}`, { ...rest, vitals, complete }).then((r) => r.data);
    },
    onSuccess: (_, { complete }) => { toast.success(complete ? 'Consultation completed' : 'Saved'); qc.invalidateQueries(); if (complete) nav('/doctor'); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const done = ['completed', 'follow_up'].includes(visit.status);
  const T = (name, label, rows) => <Textarea label={label} rows={rows} reg={register(name)} />;
  return (
    <form onSubmit={handleSubmit((d) => m.mutate({ d, complete: false }))} className="space-y-4">
      <Card title="Clinical information">
        <div className="grid gap-4 sm:grid-cols-2">{T('chiefComplaint', 'Chief complaint', 2)}{T('symptoms', 'Symptoms', 2)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{VITALS.map(([k, l, t]) => <Input key={k} label={l} type={t} step="any" reg={register(`vitals.${k}`, t === 'number' ? { valueAsNumber: true } : {})} />)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{T('medicalHistory', 'Medical history', 3)}{T('examination', 'Physical examination', 3)}{T('diagnosis', 'Diagnosis', 3)}{T('treatmentPlan', 'Treatment plan', 3)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{T('notes', 'Doctor notes', 3)}<Input label="Follow-up date" type="date" reg={register('followUpDate')} /></div>
      </Card>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-ghost" disabled={m.isPending}>Save draft</button>
        <button type="button" className="btn-primary" disabled={m.isPending} onClick={handleSubmit((d) => m.mutate({ d, complete: true }))}>{done ? 'Update & finish' : 'Complete consultation'}</button>
      </div>
    </form>
  );
}

function OrderForm({ kind, visit, onDone }) {
  const cat = kind === 'lab' ? 'laboratory' : 'xray';
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const services = useQuery({ queryKey: ['services', cat], queryFn: () => get('/services', { category: cat }) });
  const m = useMutation({
    mutationFn: (d) => api.post(`/${kind === 'lab' ? 'laboratory' : 'xray'}/orders`, { ...d, visitId: visit._id }),
    onSuccess: () => { toast.success('Order sent to the cashier for payment'); reset(); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <form onSubmit={handleSubmit((d) => m.mutate(d))} className="grid gap-3 sm:grid-cols-2">
      <Select label={kind === 'lab' ? 'Test' : 'Examination'} error={errors.serviceId} reg={register('serviceId', { required: 'Choose one' })}>
        <option value="">Select…</option>{services.data?.map((s) => <option key={s._id} value={s._id}>{s.name} — ${s.price}</option>)}
      </Select>
      {kind === 'xray' && <Input label="Body part" reg={register('bodyPart')} />}
      {kind === 'xray' && <div className="sm:col-span-2"><Input label="Clinical indication" reg={register('clinicalIndication')} /></div>}
      <div className="sm:col-span-2"><Input label="Notes for the technician (optional)" reg={register('notes')} /></div>
      <div className="sm:col-span-2"><button className="btn-primary" disabled={m.isPending}>Send order</button></div>
    </form>
  );
}

function RxForm({ visit, onDone }) {
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: { items: [{ medicine: '', strength: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' }] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const m = useMutation({
    mutationFn: (d) => api.post('/pharmacy/prescriptions', { visitId: visit._id, items: d.items.map((i) => ({ ...i, quantity: Number(i.quantity) })) }),
    onSuccess: () => { toast.success('Prescription sent to the pharmacy'); reset(); onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-3">
      {fields.map((f, i) => (
        <div key={f.id} className="grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-6">
          <div className="sm:col-span-2"><Input label="Medicine" reg={register(`items.${i}.medicine`, { required: true })} /></div>
          <Input label="Strength" placeholder="500mg" reg={register(`items.${i}.strength`)} /><Input label="Frequency" placeholder="3 times daily" reg={register(`items.${i}.frequency`)} />
          <Input label="Duration" placeholder="7 days" reg={register(`items.${i}.duration`)} /><Input label="Quantity" type="number" min="1" reg={register(`items.${i}.quantity`, { required: true })} />
          <div className="sm:col-span-5"><Input label="Instructions" reg={register(`items.${i}.instructions`)} /></div>
          <div className="flex items-end"><button type="button" className="btn-ghost btn-sm" onClick={() => remove(i)} disabled={fields.length === 1}>Remove</button></div>
        </div>
      ))}
      <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={() => append({ medicine: '', quantity: 1 })}>Add medicine</button><button className="btn-primary" disabled={m.isPending}>Send prescription</button></div>
    </form>
  );
}

function VisitOrders({ visit, refreshKey }) {
  const { user } = useAuth(); const qc = useQueryClient();
  const q = (k, url) => useQuery({ queryKey: [k, visit._id], queryFn: () => get(url, { visit: visit._id }), refetchInterval: 20_000 });
  const labs = q('lab', '/laboratory/orders'); const xr = q('xray', '/xray/orders'); const rx = q('rx', '/pharmacy/prescriptions');
  const cancel = useMutation({ mutationFn: (u) => api.patch(u), onSuccess: () => { qc.invalidateQueries(); toast.success('Cancelled'); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div className="space-y-3">
      {labs.data?.map((o) => <Card key={o._id} title={`Lab: ${o.testName}`} actions={<div className="flex items-center gap-2"><Badge value={o.status} />{!['completed', 'cancelled', 'in_progress'].includes(o.status) && <button className="btn-ghost btn-sm" onClick={() => cancel.mutate(`/laboratory/orders/${o._id}/cancel`)}>Cancel</button>}</div>}>{o.result ? <LabResultView result={o.result} hospitalId={user.hospitalId} /> : <p className="text-sm text-slate-500">{o.status === 'pending_payment' ? 'Waiting for payment at the cashier.' : 'Result pending.'}</p>}</Card>)}
      {xr.data?.map((o) => <Card key={o._id} title={`X-Ray: ${o.testName}`} actions={<div className="flex items-center gap-2"><Badge value={o.status} />{!['completed', 'cancelled', 'in_progress'].includes(o.status) && <button className="btn-ghost btn-sm" onClick={() => cancel.mutate(`/xray/orders/${o._id}/cancel`)}>Cancel</button>}</div>}>{o.report ? <XrayReportView report={o.report} hospitalId={user.hospitalId} /> : <p className="text-sm text-slate-500">{o.status === 'pending_payment' ? 'Waiting for payment at the cashier.' : 'Report pending.'}</p>}</Card>)}
      {rx.data?.map((p) => <Card key={p._id} title={`Prescription — ${dt(p.createdAt)}`} actions={<div className="flex items-center gap-2"><Badge value={p.status} />{p.status === 'pending' && <button className="btn-ghost btn-sm" onClick={() => cancel.mutate(`/pharmacy/prescriptions/${p._id}/cancel`)}>Cancel</button>}</div>}><ul className="list-disc pl-5 text-sm">{p.items.map((i) => <li key={i._id}>{i.medicine} {i.strength} — {i.frequency} for {i.duration} (qty {i.quantity}, dispensed {i.dispensedQty})</li>)}</ul></Card>)}
      {!labs.data?.length && !xr.data?.length && !rx.data?.length && <Empty>No orders for this visit yet.</Empty>}
    </div>
  );
}

export default function Consultation() {
  const { visitId } = useParams(); const qc = useQueryClient();
  const [tab, setTab] = useState('consult');
  const visit = useQuery({ queryKey: ['visit', visitId], queryFn: () => get(`/visits/${visitId}`) });
  const consult = useQuery({ queryKey: ['consult', visitId], queryFn: () => get(`/consultations/visit/${visitId}`) });
  if (visit.isLoading || consult.isLoading) return <Loading />;
  if (visit.error) return <ErrorBox error={visit.error} />;
  const v = visit.data; const p = v.patient;
  const refresh = () => qc.invalidateQueries();
  return (
    <>
      <PageHeader title={p.fullName} subtitle={`${p.patientId} · ${p.age} years · ${p.gender} · Visit #${v.visitNo} · ${v.department?.name}`}>
        <Badge value={v.status} /><Link className="btn-ghost btn-sm" to={`/patients/${p.patientId}`}>Full history</Link>
      </PageHeader>
      <Tabs value={tab} onChange={setTab} tabs={[['consult', 'Consultation'], ['lab', 'Lab order'], ['xray', 'X-Ray order'], ['rx', 'Prescription'], ['orders', 'Orders & results']]} />
      {tab === 'consult' && <ConsultForm visit={v} consultation={consult.data} />}
      {tab === 'lab' && <Card title="Request a laboratory test"><OrderForm kind="lab" visit={v} onDone={() => { refresh(); setTab('orders'); }} /></Card>}
      {tab === 'xray' && <Card title="Request an X-Ray examination"><OrderForm kind="xray" visit={v} onDone={() => { refresh(); setTab('orders'); }} /></Card>}
      {tab === 'rx' && <Card title="Write a prescription"><RxForm visit={v} onDone={() => { refresh(); setTab('orders'); }} /></Card>}
      {tab === 'orders' && <VisitOrders visit={v} />}
    </>
  );
}
