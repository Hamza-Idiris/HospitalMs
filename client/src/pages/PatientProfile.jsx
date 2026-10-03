import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Tabs, Table, Badge, Empty, Loading, ErrorBox, dt, dateOnly, money } from '../components/ui';
import { LabResultView, XrayReportView } from '../components/ResultViews';

const LABELS = { visits: 'Visits', consultations: 'Consultations', lab: 'Laboratory', xray: 'X-Ray', prescriptions: 'Prescriptions', financial: 'Payments' };

export default function PatientProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['profile', id], queryFn: () => get(`/patients/${id}/profile`) });
  const [tab, setTab] = useState(null);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const { patient: p, sections } = data;
  const active = tab || sections[0];
  return (
    <>
      <PageHeader title={p.fullName} subtitle={`${p.patientId} · ${p.age} years · ${p.gender}`} />
      <Card title="Basic information">
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[['Phone', p.phone], ['Address', p.address], ['Blood group', p.bloodGroup], ['Date of birth', dateOnly(p.dob)],
            ['Emergency contact', `${p.emergencyContact?.name} (${p.emergencyContact?.relation || 'contact'})`], ['Emergency phone', p.emergencyContact?.phone], ['Registered', dateOnly(p.createdAt)]].map(([k, v]) => (
            <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v || '—'}</dd></div>
          ))}
        </dl>
      </Card>
      {sections.length > 0 && (
        <div className="mt-6">
          <Tabs tabs={sections.map((s) => [s, LABELS[s]])} value={active} onChange={setTab} />
          {active === 'visits' && <Card><Table head={['Visit', 'Date', 'Department', 'Doctor', 'Status']} empty={!data.visits?.length && <Empty>No visits yet.</Empty>}>
            {data.visits?.map((v) => <tr key={v._id}><td className="td font-medium">#{v.visitNo}</td><td className="td">{dt(v.visitDate)}</td><td className="td">{v.department?.name}</td><td className="td">{v.doctor?.name}</td><td className="td"><Badge value={v.status} /></td></tr>)}</Table></Card>}
          {active === 'consultations' && (data.consultations?.length ? data.consultations.map((c) => (
            <Card key={c._id} className="mb-3" title={`Visit #${c.visit?.visitNo} — ${dt(c.createdAt)} — ${c.doctor?.name}`}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {[['Chief complaint', c.chiefComplaint], ['Symptoms', c.symptoms], ['Medical history', c.medicalHistory], ['Examination', c.examination], ['Diagnosis', c.diagnosis], ['Treatment plan', c.treatmentPlan], ['Doctor notes', c.notes], ['Follow-up', c.followUpDate && dateOnly(c.followUpDate)],
                  ['Vitals', c.vitals && Object.entries(c.vitals).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ')]].map(([k, v]) => v ? <div key={k}><dt className="text-slate-500">{k}</dt><dd className="whitespace-pre-wrap font-medium">{v}</dd></div> : null)}
              </dl>
            </Card>)) : <Card><Empty>No consultations yet.</Empty></Card>)}
          {active === 'lab' && (data.lab?.length ? data.lab.map((o) => <Card key={o._id} className="mb-3" title={`${o.testName} — ${dt(o.createdAt)}`} actions={<Badge value={o.status} />}>{o.result ? <LabResultView result={o.result} hospitalId={user.hospitalId} /> : <p className="text-sm text-slate-500">Result not available yet.</p>}</Card>) : <Card><Empty>No laboratory tests.</Empty></Card>)}
          {active === 'xray' && (data.xray?.length ? data.xray.map((o) => <Card key={o._id} className="mb-3" title={`${o.testName} — ${dt(o.createdAt)}`} actions={<Badge value={o.status} />}>{o.report ? <XrayReportView report={o.report} hospitalId={user.hospitalId} /> : <p className="text-sm text-slate-500">Report not available yet.</p>}</Card>) : <Card><Empty>No X-Ray records.</Empty></Card>)}
          {active === 'prescriptions' && (data.prescriptions?.length ? data.prescriptions.map((rx) => (
            <Card key={rx._id} className="mb-3" title={`${dt(rx.createdAt)} — ${rx.doctor?.name}`} actions={<Badge value={rx.status} />}>
              <Table head={['Medicine', 'Strength', 'Frequency', 'Duration', 'Qty', 'Dispensed']}>{rx.items.map((i) => <tr key={i._id}><td className="td font-medium">{i.medicine}</td><td className="td">{i.strength}</td><td className="td">{i.frequency}</td><td className="td">{i.duration}</td><td className="td">{i.quantity}</td><td className="td">{i.dispensedQty}</td></tr>)}</Table>
            </Card>)) : <Card><Empty>No prescriptions.</Empty></Card>)}
          {active === 'financial' && <Card title={`Outstanding balance: ${money(data.outstanding)}`}><Table head={['Date', 'Service', 'Original', 'Discount', 'Final', 'Paid', 'Balance', 'Receipts', 'Status']} empty={!data.payments?.length && <Empty>No payments.</Empty>}>
            {data.payments?.map((x) => <tr key={x._id}><td className="td">{dateOnly(x.createdAt)}</td><td className="td">{x.serviceName}</td><td className="td">{money(x.originalPrice)}</td><td className="td">{money(x.discount)}</td><td className="td">{money(x.finalAmount)}</td><td className="td">{money(x.amountPaid)}</td><td className="td">{money(x.balance)}</td><td className="td">{x.transactions.map((t) => t.receiptNo).join(', ') || '—'}</td><td className="td"><Badge value={x.status} /></td></tr>)}</Table></Card>}
        </div>
      )}
    </>
  );
}
