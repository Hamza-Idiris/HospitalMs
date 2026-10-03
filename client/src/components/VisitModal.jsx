import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { Modal, Select, ErrorBox } from './ui';

// Patient -> Department -> Doctor
export default function VisitModal({ patient, onClose, onDone }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: { departmentId: '', doctorId: '', chargeConsultation: true } });
  const dept = watch('departmentId');
  const depts = useQuery({ queryKey: ['departments'], queryFn: () => get('/departments') });
  const docs = useQuery({ queryKey: ['doctors', dept], queryFn: () => get('/users/doctors', { departmentId: dept }), enabled: !!dept });
  const m = useMutation({
    mutationFn: (d) => api.post('/visits', { ...d, patientId: patient.patientId }).then((r) => r.data),
    onSuccess: (r) => { toast.success(`Visit #${r.visit.visitNo} created`); qc.invalidateQueries(); onDone?.(r); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
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
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('chargeConsultation')} /> Add consultation fee to cashier queue</label>
        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={m.isPending}>Create visit</button></div>
      </form>
    </Modal>
  );
}
