// Laboratory and X-Ray technician worklist (same workflow, different result form)
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, get, errMsg } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Table, Badge, Empty, Loading, Modal, Input, Textarea, Select, ErrorBox, Tabs, dt } from '../components/ui';
import { LabResultView, XrayReportView } from '../components/ResultViews';

const PRESETS = { CBC: [['Hemoglobin', 'g/dL', '12.0–16.0'], ['WBC', '×10⁹/L', '4.0–11.0'], ['Platelets', '×10⁹/L', '150–450']], 'Blood Sugar': [['Glucose', 'mg/dL', '70–140']], 'Malaria Test': [['Malaria parasite', '', 'Negative']] };

function ResultModal({ kind, order, onClose }) {
  const qc = useQueryClient();
  const base = `/${kind === 'lab' ? 'laboratory' : 'xray'}/orders/${order._id}/result`;
  const preset = (PRESETS[order.testName] || [['', '', '']]).map(([name, unit, range]) => ({ name, unit, range, result: '', flag: '' }));
  const { register, control, handleSubmit } = useForm({ defaultValues: { items: preset, bodyPart: order.bodyPart || '' } });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [files, setFiles] = useState([]);
  const m = useMutation({
    mutationFn: (d) => {
      const fd = new FormData();
      if (kind === 'lab') { fd.append('items', JSON.stringify(d.items)); fd.append('notes', d.notes || ''); }
      else { ['bodyPart', 'findings', 'impression', 'technicalNotes'].forEach((k) => fd.append(k, d[k] || '')); }
      files.forEach((f) => fd.append('attachments', f));
      return api.post(base, fd).then((r) => r.data);
    },
    onSuccess: () => { toast.success(kind === 'lab' ? 'Result submitted' : 'Report submitted'); qc.invalidateQueries(); onClose(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Modal wide title={`${kind === 'lab' ? 'Enter results' : 'X-Ray report'} — ${order.testName}`} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">{order.patient?.fullName} ({order.patient?.patientId}) · requested by {order.doctor?.name}{order.notes ? ` · “${order.notes}”` : ''}{order.clinicalIndication ? ` · Indication: ${order.clinicalIndication}` : ''}</p>
      <form className="space-y-4" onSubmit={handleSubmit((d) => m.mutate(d))}>
        {kind === 'lab' ? (
          <>
            <div className="space-y-2">{fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_1.2fr_1fr_auto]">
                <input className="input" placeholder="Test" {...register(`items.${i}.name`, { required: true })} /><input className="input" placeholder="Result" {...register(`items.${i}.result`, { required: true })} />
                <input className="input" placeholder="Unit" {...register(`items.${i}.unit`)} /><input className="input" placeholder="Reference range" {...register(`items.${i}.range`)} />
                <select className="input" {...register(`items.${i}.flag`)}><option value="">Flag</option><option value="normal">Normal</option><option value="low">Low</option><option value="high">High</option><option value="abnormal">Abnormal</option></select>
                <button type="button" className="btn-ghost btn-sm" onClick={() => remove(i)} disabled={fields.length === 1} aria-label="Remove row">✕</button>
              </div>))}
              <button type="button" className="btn-ghost btn-sm" onClick={() => append({ name: '', result: '', unit: '', range: '', flag: '' })}>Add row</button></div>
            <Textarea label="Technician notes" reg={register('notes')} />
          </>
        ) : (
          <>
            <Input label="Body part" reg={register('bodyPart')} />
            <Textarea label="Findings" rows={4} reg={register('findings', { required: true })} /><Textarea label="Impression" reg={register('impression')} /><Textarea label="Technical notes" reg={register('technicalNotes')} />
          </>
        )}
        <label className="block text-sm"><span className="mb-1 block font-medium">Attachments (PDF, JPG, PNG, up to 10 MB)</span><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.dcm" onChange={(e) => setFiles([...e.target.files])} /></label>
        <ErrorBox error={m.error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={m.isPending}>Submit</button></div>
      </form>
    </Modal>
  );
}

export default function TechOrders({ kind }) {
  const { user } = useAuth(); const qc = useQueryClient();
  const [tab, setTab] = useState('todo'); const [active, setActive] = useState(null); const [view, setView] = useState(null);
  const base = kind === 'lab' ? '/laboratory' : '/xray';
  const { data, isLoading } = useQuery({ queryKey: ['tech', kind], queryFn: () => get(`${base}/orders`), refetchInterval: 15_000 });
  const start = useMutation({ mutationFn: (id) => api.patch(`${base}/orders/${id}/start`), onSuccess: () => { toast.success('Started'); qc.invalidateQueries(); }, onError: (e) => toast.error(errMsg(e)) });
  const groups = { todo: ['requested', 'paid'], waiting: ['pending_payment'], progress: ['in_progress'], done: ['completed'] };
  const rows = (data || []).filter((o) => groups[tab].includes(o.status));
  const count = (k) => (data || []).filter((o) => groups[k].includes(o.status)).length;
  return (
    <>
      <PageHeader title={kind === 'lab' ? 'Laboratory requests' : 'X-Ray requests'} subtitle="Paid requests are ready to start" />
      <Tabs value={tab} onChange={setTab} tabs={[['todo', `Ready (${count('todo')})`], ['waiting', `Awaiting payment (${count('waiting')})`], ['progress', `In progress (${count('progress')})`], ['done', 'Completed']]} />
      <Card>{isLoading ? <Loading /> : !rows.length ? <Empty>Nothing in this list.</Empty> : (
        <Table head={['Requested', 'Patient', kind === 'lab' ? 'Test' : 'Examination', 'Doctor', 'Payment', '']}>
          {rows.map((o) => <tr key={o._id}><td className="td">{dt(o.createdAt)}</td><td className="td">{o.patient?.fullName}<div className="text-xs text-slate-500">{o.patient?.patientId} · {o.patient?.age}y · {o.patient?.gender}</div></td>
            <td className="td font-medium">{o.testName}{o.bodyPart && <div className="text-xs font-normal text-slate-500">{o.bodyPart}</div>}</td><td className="td">{o.doctor?.name}</td><td className="td"><Badge value={o.payment?.status || 'pending'} /></td>
            <td className="td text-right">
              {['requested', 'paid'].includes(o.status) && <button className="btn-primary btn-sm" onClick={() => start.mutate(o._id)}>Start</button>}
              {o.status === 'in_progress' && <button className="btn-primary btn-sm" onClick={() => setActive(o)}>{kind === 'lab' ? 'Enter results' : 'Write report'}</button>}
              {o.status === 'completed' && <button className="btn-ghost btn-sm" onClick={() => setView(o)}>View</button>}
            </td></tr>)}
        </Table>
      )}</Card>
      {active && <ResultModal kind={kind} order={active} onClose={() => setActive(null)} />}
      {view && <Modal wide title={view.testName} onClose={() => setView(null)}>{kind === 'lab' ? <LabResultView result={view.result} hospitalId={user.hospitalId} /> : <XrayReportView report={view.report} hospitalId={user.hospitalId} />}</Modal>}
    </>
  );
}
