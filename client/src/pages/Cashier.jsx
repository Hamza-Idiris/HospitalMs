import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Table, Badge, Empty, Loading, Modal, Input, Select, ErrorBox, money, dt } from '../components/ui';
import Receipt from '../components/Receipt';

function PayModal({ payment: p, onClose, onPaid }) {
  const { hospital } = useAuth(); const cur = hospital?.settings?.currency || 'USD'; const qc = useQueryClient();
  const { register, handleSubmit, watch } = useForm({ defaultValues: { discount: p.discount || 0, discountReason: p.discountReason || '', amount: p.balance, method: 'cash' } });
  const disc = Number(watch('discount') || 0);
  const due = Math.max(p.originalPrice - disc, 0);
  const m = useMutation({
    mutationFn: (d) => api.post(`/payments/${p._id}/pay`, { amount: Number(d.amount), method: d.method, discount: Number(d.discount || 0), discountReason: d.discountReason }).then((r) => r.data),
    onSuccess: (r) => { toast.success(`Payment received — ${r.receiptNo}`); qc.invalidateQueries(); onPaid(r); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const locked = p.amountPaid > 0;
  return (
    <Modal title={`Receive payment — ${p.serviceName}`} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">{p.patient?.fullName} ({p.patient?.patientId})</p>
      <form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate(d))}>
        <div className="grid grid-cols-3 gap-3 text-sm"><div><div className="text-slate-500">Original</div><b>{money(p.originalPrice, cur)}</b></div><div><div className="text-slate-500">Already paid</div><b>{money(p.amountPaid, cur)}</b></div><div><div className="text-slate-500">To pay</div><b>{money(due - p.amountPaid, cur)}</b></div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Discount" type="number" step="0.01" min="0" disabled={locked} reg={register('discount')} />
          <Input label="Discount reason" disabled={locked || disc === 0} reg={register('discountReason')} />
          <Input label="Amount received" type="number" step="0.01" min="0.01" reg={register('amount', { required: true })} />
          <Select label="Method" reg={register('method')}><option value="cash">Cash</option><option value="evc_plus">EVC Plus</option><option value="edahab">eDahab</option><option value="card">Card</option><option value="other">Other</option></Select>
        </div>
        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={m.isPending}>Confirm payment</button></div>
      </form>
    </Modal>
  );
}

export function PendingPayments() {
  const [q, setQ] = useState(''); const [pay, setPay] = useState(null); const [receipt, setReceipt] = useState(null);
  const { hospital } = useAuth(); const cur = hospital?.settings?.currency || 'USD';
  const { data, isLoading } = useQuery({ queryKey: ['payments', 'pending', q], queryFn: () => get('/payments', { status: 'pending,partial', q }), refetchInterval: 15_000 });
  return (
    <>
      <PageHeader title="Pending payments" subtitle="Charges requested by the front desk and doctors" />
      <Card>
        <input className="input mb-4 max-w-md" placeholder="Search patient ID, name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        {isLoading ? <Loading /> : !data?.length ? <Empty>No pending payments.</Empty> : (
          <Table head={['Requested', 'Patient', 'Service', 'Price', 'Balance', 'Status', '']}>
            {data.map((p) => <tr key={p._id}><td className="td">{dt(p.createdAt)}</td><td className="td">{p.patient?.fullName}<div className="text-xs text-slate-500">{p.patient?.patientId}</div></td><td className="td">{p.serviceName}</td>
              <td className="td">{money(p.originalPrice, cur)}</td><td className="td font-medium">{money(p.balance, cur)}</td><td className="td"><Badge value={p.status} /></td>
              <td className="td text-right"><button className="btn-primary btn-sm" onClick={() => setPay(p)}>Receive payment</button></td></tr>)}
          </Table>
        )}
      </Card>
      {pay && <PayModal payment={pay} onClose={() => setPay(null)} onPaid={(r) => { setPay(null); setReceipt({ id: r.payment._id, no: r.receiptNo }); }} />}
      {receipt && <Receipt paymentId={receipt.id} receiptNo={receipt.no} onClose={() => setReceipt(null)} />}
    </>
  );
}

export function PaymentHistory({ manager = false }) {
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [receipt, setReceipt] = useState(null);
  const qc = useQueryClient(); const { hospital } = useAuth(); const cur = hospital?.settings?.currency || 'USD';
  const { data, isLoading } = useQuery({ queryKey: ['payments', 'history', q, status], queryFn: () => get('/payments', { q, status: status || 'partial,paid,refunded,cancelled' }) });
  const cancel = useMutation({ mutationFn: (id) => api.post(`/payments/${id}/cancel`), onSuccess: () => { toast.success('Payment closed'); qc.invalidateQueries({ queryKey: ['payments'] }); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <>
      <PageHeader title={manager ? 'Payments' : 'Payment history'} subtitle="Prices shown are the prices at the time of the transaction" />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <input className="input max-w-sm" placeholder="Patient ID, name, phone or receipt number" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input max-w-[11rem]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All closed/paid</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></select>
        </div>
        {isLoading ? <Loading /> : !data?.length ? <Empty>No payments found.</Empty> : (
          <Table head={['Date', 'Patient', 'Service', 'Original', 'Discount', 'Final', 'Paid', 'Balance', 'Receipts', 'Status', '']}>
            {data.map((p) => <tr key={p._id}><td className="td">{dt(p.createdAt)}</td><td className="td">{p.patient?.fullName}<div className="text-xs text-slate-500">{p.patient?.patientId}</div></td><td className="td">{p.serviceName}</td>
              <td className="td">{money(p.originalPrice, cur)}</td><td className="td">{p.discount > 0 ? <span title={`${p.discountReason} — ${p.discountBy?.name}`}>{money(p.discount, cur)}</span> : '—'}</td><td className="td">{money(p.finalAmount, cur)}</td><td className="td">{money(p.amountPaid, cur)}</td><td className="td">{money(p.balance, cur)}</td>
              <td className="td">{p.transactions.map((t) => <button key={t.receiptNo} className="mr-1 text-brand underline" onClick={() => setReceipt({ id: p._id, no: t.receiptNo })}>{t.receiptNo}</button>)}</td>
              <td className="td"><Badge value={p.status} /></td>
              <td className="td">{manager && !['cancelled', 'refunded'].includes(p.status) && <button className="btn-ghost btn-sm" onClick={() => confirm(p.amountPaid > 0 ? 'Refund this payment?' : 'Cancel this charge?') && cancel.mutate(p._id)}>{p.amountPaid > 0 ? 'Refund' : 'Cancel'}</button>}</td></tr>)}
          </Table>
        )}
      </Card>
      {receipt && <Receipt paymentId={receipt.id} receiptNo={receipt.no} onClose={() => setReceipt(null)} />}
    </>
  );
}
