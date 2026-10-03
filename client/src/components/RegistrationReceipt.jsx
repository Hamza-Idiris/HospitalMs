import { Modal, money, dt } from './ui';
import { useAuth } from '../auth';

export default function RegistrationReceipt({ data, onClose }) {
  const { hospital } = useAuth();
  const cur = hospital?.settings?.currency || 'USD';
  const { patient, visit, charge, receiptNo, discount = 0, discountReason = '', paymentMethod = 'cash' } = data || {};

  const originalPrice = charge?.originalPrice || 0;
  const finalAmount = charge?.finalAmount !== undefined ? charge.finalAmount : Math.max(0, originalPrice - discount);
  const paidAmount = charge?.amountPaid !== undefined ? charge.amountPaid : finalAmount;
  const balance = charge?.balance !== undefined ? charge.balance : 0;

  return (
    <Modal title="Patient Registration & Ticket" onClose={onClose}>
      <div id="receipt-print" className="mx-auto w-[76mm] rounded border border-dashed border-slate-300 p-3 font-mono text-xs shadow-sm bg-white" style={{ display: 'block' }}>
        <div className="text-center">
          <div className="text-base font-bold uppercase">{hospital?.name || 'Hospital'}</div>
          <div>{hospital?.address}</div>
          <div>{hospital?.phone}</div>
        </div>
        <hr className="my-2 border-dashed border-slate-300" />
        
        <div className="my-2 text-center rounded border border-slate-400 bg-slate-50 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Daily Waiting Number</div>
          <div className="text-3xl font-black text-slate-900">#{visit?.dailySeq || visit?.visitNo || 1}</div>
        </div>

        <hr className="my-2 border-dashed border-slate-300" />
        <Row k="Date" v={dt(visit?.createdAt || new Date())} />
        <Row k="Patient ID" v={<b>{patient?.patientId}</b>} />
        <Row k="Name" v={patient?.fullName} />
        <Row k="Phone" v={patient?.phone} />
        {visit?.department?.name && <Row k="Dept" v={visit.department.name} />}
        {visit?.doctor?.name && <Row k="Doctor" v={visit.doctor.name} />}
        
        <hr className="my-2 border-dashed border-slate-300" />
        <div className="font-bold mb-1">Registration & Fee Details</div>
        <Row k="Reg / Fee" v={money(originalPrice, cur)} />
        {discount > 0 && <Row k="Discount" v={`-${money(discount, cur)}`} />}
        {discountReason && <div className="text-[10px] text-slate-500 text-right italic">Reason: {discountReason}</div>}
        <Row k="Total Due" v={money(finalAmount, cur)} />
        <Row k="Amount Paid" v={<b>{money(paidAmount, cur)}</b>} />
        <Row k="Balance" v={money(balance, cur)} />
        <Row k="Method" v={paymentMethod.toUpperCase().replace('_', ' ')} />
        {receiptNo && <Row k="Receipt No" v={receiptNo} />}

        <hr className="my-2 border-dashed border-slate-300" />
        <div className="mt-2 text-center text-[10px] text-slate-500">
          Please keep this ticket for your visit today.<br />Thank you!
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={() => window.print()}>Print Ticket / Receipt</button>
      </div>
    </Modal>
  );
}

const Row = ({ k, v }) => (
  <div className="flex justify-between gap-2 py-0.5">
    <span className="text-slate-600">{k}</span>
    <span className="text-right font-medium text-slate-900">{v}</span>
  </div>
);
