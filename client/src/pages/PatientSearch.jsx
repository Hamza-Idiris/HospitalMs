import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Card, Table, Empty, Loading, dateOnly } from '../components/ui';
import VisitModal from '../components/VisitModal';

export default function PatientSearch({ title = 'Find patient' }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [visitFor, setVisitFor] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['patients', q], queryFn: () => get('/patients', { q }) });
  const canVisit = ['cashier', 'manager'].includes(user.role);
  return (
    <>
      <PageHeader title={title} subtitle="Search by patient ID, name or phone number" />
      <Card>
        <input className="input mb-4 max-w-md" placeholder="PT-000145, Ahmed, 61…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patients" />
        {isLoading ? <Loading /> : !data?.length ? <Empty>{q ? 'No patient matches your search.' : 'No patients yet.'}</Empty> : (
          <Table head={['Patient ID', 'Name', 'Age / gender', 'Phone', 'Registered', '']}>
            {data.map((p) => (
              <tr key={p._id}>
                <td className="td font-medium">{p.patientId}</td><td className="td">{p.fullName}</td><td className="td">{p.age} · {p.gender}</td>
                <td className="td">{p.phone}</td><td className="td">{dateOnly(p.createdAt)}</td>
                <td className="td flex justify-end gap-2"><Link className="btn-ghost btn-sm" to={`/patients/${p.patientId}`}>Open</Link>{canVisit && <button className="btn-primary btn-sm" onClick={() => setVisitFor(p)}>New visit</button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {visitFor && <VisitModal patient={visitFor} onClose={() => setVisitFor(null)} />}
    </>
  );
}
