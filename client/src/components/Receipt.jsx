import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { Modal, Loading, money, dt } from './ui';

// Fetches and prints a receipt (receipt-friendly layout, see index.css @media print)
export default function Receipt({ paymentId, receiptNo, onClose }) {
  const { data: r, isLoading } = useQuery({ queryKey: ['receipt', paymentId, receiptNo], queryFn: () => get(`/payments/${paymentId}/receipt/${receiptNo}`) });
  const cur = r?.hospital?.settings?.currency || 'USD';
  return (
    <Modal title={`Receipt ${receiptNo}`} onClose={onClose}>
      {isLoading ? <Loading /> : (
        <>
          <div id="receipt-print" className="mx-auto w-[76mm] rounded border border-dashed border-slate-300 p-3 font-mono text-xs" style={{ display: 'block' }}>
            <div className="text-center"><div className="text-sm font-bold">{r.hospital.name}</div><div>{r.hospital.address}</div><div>{r.hospital.phone}</div></div>
            <hr className="my-2 border-dashed" />
            <Row k="Receipt" v={r.receiptNo} /><Row k="Date" v={dt(r.at)} /><Row k="Patient" v={r.patient?.fullName} /><Row k="Patient ID" v={r.patient?.patientId} />
            <hr className="my-2 border-dashed" />
            <Row k="Service" v={r.service} /><Row k="Original" v={money(r.originalAmount, cur)} />
            {r.discount > 0 && <Row k="Discount" v={`-${money(r.discount, cur)}`} />}
            <Row k="Total due" v={money(r.finalAmount, cur)} /><Row k="Paid now" v={<b>{money(r.paid, cur)}</b>} />
            <Row k="Balance" v={money(r.balance, cur)} /><Row k="Method" v={r.method.replace('_', ' ')} />
            <hr className="my-2 border-dashed" />
            <Row k="Cashier" v={r.cashier} />
            <div className="mt-3 text-center">Thank you</div>
          </div>
          <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" onClick={() => window.print()}>Print receipt</button></div>
        </>
      )}
    </Modal>
  );
}
const Row = ({ k, v }) => <div className="flex justify-between gap-2"><span>{k}</span><span className="text-right">{v}</span></div>;
