import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { PageHeader, Card, Table, Badge, Empty, Loading, Modal, ErrorBox, Tabs, dt } from '../components/ui';

function Dispense({ rx, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm({ defaultValues: Object.fromEntries(rx.items.map((i) => [i._id, i.quantity - i.dispensedQty])) });
  const m = useMutation({
    mutationFn: (d) => api.post(`/pharmacy/prescriptions/${rx._id}/dispense`, { lines: Object.entries(d).map(([itemId, qty]) => ({ itemId, qty: Number(qty) })).filter((l) => l.qty > 0) }),
    onSuccess: () => { toast.success('Dispensing recorded'); qc.invalidateQueries(); onClose(); }, onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal wide title={`Dispense — ${rx.patient?.fullName} (${rx.patient?.patientId})`} onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600">Prescribed by {rx.doctor?.name} · {dt(rx.createdAt)}</p>
      <form onSubmit={handleSubmit((d) => m.mutate(d))}>
        <Table head={['Medicine', 'Instructions', 'Prescribed', 'Already given', 'Give now']}>
          {rx.items.map((i) => <tr key={i._id}><td className="td font-medium">{i.medicine} {i.strength}</td><td className="td">{[i.dosage, i.frequency, i.duration].filter(Boolean).join(' · ')}{i.instructions && <div className="text-xs text-slate-500">{i.instructions}</div>}</td><td className="td">{i.quantity}</td><td className="td">{i.dispensedQty}</td>
            <td className="td"><input className="input w-20" type="number" min="0" max={i.quantity - i.dispensedQty} disabled={i.quantity - i.dispensedQty <= 0} {...register(i._id)} /></td></tr>)}
        </Table>
        <div className="mt-3"><ErrorBox error={m.error} /></div>
        <div className="mt-4 flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={m.isPending}>Record dispensing</button></div>
      </form>
    </Modal>
  );
}

export default function Pharmacy() {
  const [tab, setTab] = useState('open'); const [rx, setRx] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['rx', tab], queryFn: () => get('/pharmacy/prescriptions', { status: tab === 'open' ? 'pending,partial' : 'dispensed,cancelled' }), refetchInterval: 15_000 });
  return (
    <>
      <PageHeader title="Prescriptions" subtitle="Dispense medicines and keep a record of every handover" />
      <Tabs value={tab} onChange={setTab} tabs={[['open', 'To dispense'], ['history', 'Dispensing history']]} />
      <Card>{isLoading ? <Loading /> : !data?.length ? <Empty>No prescriptions in this list.</Empty> : (
        <Table head={['Date', 'Patient', 'Doctor', 'Medicines', 'Status', '']}>
          {data.map((p) => <tr key={p._id}><td className="td">{dt(p.createdAt)}</td><td className="td">{p.patient?.fullName}<div className="text-xs text-slate-500">{p.patient?.patientId}</div></td><td className="td">{p.doctor?.name}</td><td className="td">{p.items.map((i) => i.medicine).join(', ')}</td><td className="td"><Badge value={p.status} /></td>
            <td className="td text-right"><button className={['pending', 'partial'].includes(p.status) ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'} onClick={() => setRx(p)}>{['pending', 'partial'].includes(p.status) ? 'Dispense' : 'View'}</button></td></tr>)}
        </Table>
      )}</Card>
      {rx && (['pending', 'partial'].includes(rx.status) ? <Dispense rx={rx} onClose={() => setRx(null)} /> : (
        <Modal title="Prescription" onClose={() => setRx(null)}><ul className="list-disc pl-5 text-sm">{rx.items.map((i) => <li key={i._id}>{i.medicine} {i.strength} — qty {i.quantity}, dispensed {i.dispensedQty}</li>)}</ul></Modal>
      ))}
    </>
  );
}
