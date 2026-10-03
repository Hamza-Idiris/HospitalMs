import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { useAuth } from '../auth';
import { Modal, Select, Input, ErrorBox, money } from './ui';
import RegistrationReceipt from './RegistrationReceipt';

// Patient -> Department -> Doctor + Payment Collection
export default function VisitModal({ patient, onClose, onDone }) {
  const qc = useQueryClient();
  const { hospital } = useAuth();
  const cur = hospital?.settings?.currency || 'USD';
  const [printData, setPrintData] = useState(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { departmentId: '', doctorId: '', chargeConsultation: true, collectPaymentNow: true, discount: 0, discountReason: '', amountReceived: 0, paymentMethod: 'cash' },
  });

  const dept = watch('departmentId');
  const chargeConsultation = watch('chargeConsultation');
  const collectNow = watch('collectPaymentNow');
  const discountVal = Number(watch('discount') || 0);

  const depts = useQuery({ queryKey: ['departments'], queryFn: () => get('/departments') });
  const docs = useQuery({ queryKey: ['doctors', dept], queryFn: () => get('/users/doctors', { departmentId: dept }), enabled: !!dept });
  
  // Fetch registration / consultation service default price
  const consultationSvc = useQuery({
    queryKey: ['services', 'consultation'],
    queryFn: async () => {
      const svcs = await get('/services');
      return svcs.find((s) => s.category === 'consultation' && s.isActive) || svcs[0];
    },
  });

  const origPrice = consultationSvc.data?.price || 0;
  const finalPrice = Math.max(0, origPrice - discountVal);

  const m = useMutation({
    mutationFn: (d) => api.post('/visits', {
      patientId: patient.patientId,
      departmentId: d.departmentId,
      doctorId: d.doctorId,
      chargeConsultation: d.chargeConsultation,
      discount: d.collectPaymentNow ? d.discount : 0,
      discountReason: d.discountReason,
      amountReceived: d.collectPaymentNow ? (d.amountReceived || finalPrice) : 0,
      paymentMethod: d.paymentMethod,
    }).then((r) => r.data),
    onSuccess: (res) => {
      toast.success(`Visit created! Ticket #${res.dailySeq || res.visit.visitNo}`);
      qc.invalidateQueries();
      const pData = {
        patient,
        visit: { ...res.visit, dailySeq: res.dailySeq },
        charge: res.charge || { originalPrice: origPrice, finalAmount: finalPrice, amountPaid: collectNow ? finalPrice : 0, balance: collectNow ? 0 : finalPrice },
        receiptNo: res.receiptNo,
        discount: discountVal,
        discountReason: watch('discountReason'),
        paymentMethod: watch('paymentMethod'),
      };
      setPrintData(pData);
      onDone?.(res);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (printData) {
    return <RegistrationReceipt data={printData} onClose={() => { setPrintData(null); onClose(); }} />;
  }

  return (
    <Modal title={`New visit — ${patient.fullName} (${patient.patientId})`} onClose={onClose}>
      <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
        <Select label="Department" error={errors.departmentId} reg={register('departmentId', { required: 'Choose a department' })}>
          <option value="">Select department</option>{depts.data?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </Select>

        <Select label="Doctor" error={errors.doctorId} reg={register('doctorId', { required: 'Choose a doctor' })} disabled={!dept}>
          <option value="">{dept ? (docs.data?.length ? 'Select doctor' : 'No doctors in this department') : 'Select a department first'}</option>
          {docs.data?.map((d) => <option key={d._id} value={d._id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ''}</option>)}
        </Select>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="rounded" {...register('chargeConsultation')} />
            Add Registration & Consultation Fee ({money(origPrice, cur)})
          </label>

          {chargeConsultation && (
            <div className="pt-2 border-t border-slate-200 space-y-3 text-sm">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" className="rounded" {...register('collectPaymentNow')} />
                Collect payment & print receipt now (No pending payment)
              </label>

              {collectNow && (
                <div className="grid gap-3 sm:grid-cols-2 pt-1">
                  <Input label={`Discount (${cur})`} type="number" step="0.01" min="0" reg={register('discount')} />
                  <Input label="Discount Reason" disabled={discountVal === 0} reg={register('discountReason')} />
                  <Input label={`Amount Received (${cur})`} type="number" step="0.01" min="0" defaultValue={finalPrice} reg={register('amountReceived')} hint={`Total Due: ${money(finalPrice, cur)}`} />
                  <Select label="Payment Method" reg={register('paymentMethod')}>
                    <option value="cash">Cash</option>
                    <option value="evc_plus">EVC Plus</option>
                    <option value="edahab">eDahab</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={m.isPending}>
            {collectNow && chargeConsultation ? 'Create Visit & Print Ticket' : 'Create Visit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
