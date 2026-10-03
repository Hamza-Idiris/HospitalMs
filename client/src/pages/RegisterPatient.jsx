import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { PageHeader, Card, Input, Select, ErrorBox } from '../components/ui';
import VisitModal from '../components/VisitModal';

export default function RegisterPatient() {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, getValues, formState: { errors } } = useForm({ defaultValues: { gender: 'male', bloodGroup: 'Unknown' } });
  const [created, setCreated] = useState(null);
  const [dup, setDup] = useState(null);
  const [visit, setVisit] = useState(false);
  const m = useMutation({
    mutationFn: (d) => api.post('/patients', clean(d)).then((r) => r.data),
    onSuccess: (p) => { setCreated(p); setDup(null); qc.invalidateQueries({ queryKey: ['patients'] }); toast.success(`Registered ${p.patientId}`); },
    onError: (e) => { if (e.response?.status === 409 && e.response.data.duplicate) setDup(e.response.data); else toast.error(errMsg(e)); },
  });
  const clean = (d) => ({ ...d, dob: d.dob || undefined, age: d.age === '' || d.age === undefined ? undefined : Number(d.age) });

  if (created) return (
    <>
      <PageHeader title="Patient registered" />
      <Card><div className="text-sm text-slate-500">Patient ID</div><div className="text-3xl font-bold">{created.patientId}</div><div className="mt-1">{created.fullName}</div>
        <div className="mt-5 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setVisit(true)}>Create visit</button><Link className="btn-ghost" to={`/patients/${created.patientId}`}>View profile</Link><button className="btn-ghost" onClick={() => { setCreated(null); reset(); }}>Register another</button></div></Card>
      {visit && <VisitModal patient={created} onClose={() => setVisit(false)} />}
    </>
  );
  return (
    <>
      <PageHeader title="Register patient" subtitle="Registration records identity only. Symptoms and diagnosis are recorded by the doctor." />
      <form onSubmit={handleSubmit((d) => m.mutate(d))}>
        <Card title="Patient details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" error={errors.fullName} reg={register('fullName', { required: 'Enter the full name' })} />
            <Select label="Gender" reg={register('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select>
            <Input label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} reg={register('dob')} hint="Or enter age below" />
            <Input label="Age (years)" type="number" min="0" max="130" error={errors.age} reg={register('age', { validate: (v) => v !== '' || getValues('dob') !== '' || 'Enter age or date of birth' })} />
            <Input label="Phone number" error={errors.phone} reg={register('phone', { required: 'Enter a phone number', minLength: { value: 5, message: 'Too short' } })} />
            <Select label="Blood group" reg={register('bloodGroup')}>{['Unknown', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</Select>
            <div className="sm:col-span-2"><Input label="Address" error={errors.address} reg={register('address', { required: 'Enter the address' })} /></div>
          </div>
        </Card>
        <Card title="Emergency contact" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Name" error={errors.emergencyContact?.name} reg={register('emergencyContact.name', { required: 'Required' })} />
            <Input label="Phone" error={errors.emergencyContact?.phone} reg={register('emergencyContact.phone', { required: 'Required' })} />
            <Input label="Relation" reg={register('emergencyContact.relation')} />
          </div>
        </Card>
        {dup && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <b>Possible duplicate:</b> {dup.duplicate.fullName} ({dup.duplicate.patientId}) already has this name and phone number.
            <div className="mt-3 flex gap-2"><Link className="btn-primary btn-sm" to={`/patients/${dup.duplicate.patientId}`}>Open existing patient</Link>
              <button type="button" className="btn-ghost btn-sm" onClick={() => m.mutate({ ...getValues(), force: true })}>Register as a new patient anyway</button></div>
          </div>
        )}
        <div className="mt-4"><ErrorBox error={m.error && !dup ? m.error : null} /></div>
        <div className="mt-4 flex justify-end"><button className="btn-primary" disabled={m.isPending}>Register patient</button></div>
      </form>
    </>
  );
}
