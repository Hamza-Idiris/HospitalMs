import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { PageHeader, Card, Table, Badge, Empty, Loading, Modal, Select, ErrorBox, dt } from '../components/ui';

export default function ReceptionVisits() {
  const [editVisit, setEditVisit] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['visits-today'], queryFn: () => get('/visits', { today: 'true' }), refetchInterval: 15_000 });

  return (
    <>
      <PageHeader title="Today’s visits" subtitle="Manage and reassign visits if a patient picked the wrong department" />
      <Card>
        {isLoading ? <Loading /> : !data?.length ? <Empty>No visits yet today.</Empty> : (
          <Table head={['Arrived', 'Waiting #', 'Patient ID', 'Patient', 'Department', 'Doctor', 'Visit', 'Status', '']}>
            {data.map((v) => (
              <tr key={v._id}>
                <td className="td">{dt(v.visitDate)}</td>
                <td className="td font-bold text-slate-800">#{v.dailySeq || v.visitNo}</td>
                <td className="td font-medium">{v.patient?.patientId}</td>
                <td className="td">{v.patient?.fullName}</td>
                <td className="td">{v.department?.name}</td>
                <td className="td">{v.doctor?.name}</td>
                <td className="td">#{v.visitNo}</td>
                <td className="td"><Badge value={v.status} /></td>
                <td className="td text-right">
                  {v.status === 'waiting' && (
                    <button className="btn-ghost btn-sm" onClick={() => setEditVisit(v)}>
                      Change Department / Doctor
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editVisit && <EditVisitModal visit={editVisit} onClose={() => setEditVisit(null)} />}
    </>
  );
}

function EditVisitModal({ visit, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { departmentId: visit.department?._id || '', doctorId: visit.doctor?._id || '' },
  });

  const dept = watch('departmentId');
  const depts = useQuery({ queryKey: ['departments'], queryFn: () => get('/departments') });
  const docs = useQuery({ queryKey: ['doctors', dept], queryFn: () => get('/users/doctors', { departmentId: dept }), enabled: !!dept });

  const m = useMutation({
    mutationFn: (d) => api.put(`/visits/${visit._id}`, d).then((r) => r.data),
    onSuccess: (updated) => {
      toast.success(`Reassigned ${visit.patient?.fullName || 'Patient'} to ${updated.department?.name} - ${updated.doctor?.name}`);
      qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Modal title={`Change Department / Doctor — #${visit.dailySeq || visit.visitNo}`} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        Reassign <b>{visit.patient?.fullName}</b> to a different department without charging any additional fee.
      </p>
      <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
        <Select label="New Department" error={errors.departmentId} reg={register('departmentId', { required: 'Choose a department' })}>
          <option value="">Select department</option>
          {depts.data?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </Select>

        <Select label="New Doctor" error={errors.doctorId} reg={register('doctorId', { required: 'Choose a doctor' })} disabled={!dept}>
          <option value="">{dept ? (docs.data?.length ? 'Select doctor' : 'No doctors in this department') : 'Select a department first'}</option>
          {docs.data?.map((d) => <option key={d._id} value={d._id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ''}</option>)}
        </Select>

        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={m.isPending}>Save & Reassign</button>
        </div>
      </form>
    </Modal>
  );
}
