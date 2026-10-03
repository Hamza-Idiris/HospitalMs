import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { get } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Table, Badge, Empty, Loading, Tabs, dt, dateOnly } from '../components/ui';
import { LabResultView, XrayReportView } from '../components/ResultViews';

export function FollowUps() {
  const { data, isLoading } = useQuery({ queryKey: ['followups'], queryFn: () => get('/consultations/follow-ups/list') });
  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Patients you asked to come back" />
      <Card>{isLoading ? <Loading /> : !data?.length ? <Empty>No upcoming follow-ups.</Empty> : (
        <Table head={['Date', 'Patient ID', 'Patient', 'Phone', '']}>{data.map((c) => <tr key={c._id}><td className="td font-medium">{dateOnly(c.followUpDate)}</td><td className="td">{c.patient?.patientId}</td><td className="td">{c.patient?.fullName}</td><td className="td">{c.patient?.phone}</td><td className="td text-right"><Link className="btn-ghost btn-sm" to={`/patients/${c.patient?.patientId}`}>Open</Link></td></tr>)}</Table>
      )}</Card>
    </>
  );
}

export function DoctorOrders() {
  const { user } = useAuth(); const [tab, setTab] = useState('lab');
  const lab = useQuery({ queryKey: ['d-lab'], queryFn: () => get('/laboratory/orders') });
  const xr = useQuery({ queryKey: ['d-xray'], queryFn: () => get('/xray/orders') });
  const list = tab === 'lab' ? lab.data : xr.data;
  return (
    <>
      <PageHeader title="Orders & results" subtitle="Laboratory and X-Ray requests you made" />
      <Tabs value={tab} onChange={setTab} tabs={[['lab', 'Laboratory'], ['xray', 'X-Ray']]} />
      {!list ? <Loading /> : !list.length ? <Card><Empty>No orders yet.</Empty></Card> : list.map((o) => (
        <Card key={o._id} className="mb-3" title={`${o.testName} — ${o.patient?.fullName} (${o.patient?.patientId})`} actions={<Badge value={o.status} />}>
          {tab === 'lab' ? (o.result ? <LabResultView result={o.result} hospitalId={user.hospitalId} /> : <p className="text-sm text-slate-500">No result yet.</p>) : (o.report ? <XrayReportView report={o.report} hospitalId={user.hospitalId} /> : <p className="text-sm text-slate-500">No report yet.</p>)}
          <p className="mt-2 text-xs text-slate-500">Requested {dt(o.createdAt)}</p>
        </Card>
      ))}
    </>
  );
}
