import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '../api';
import { useAuth } from '../auth';
import { PageHeader, Stat, Loading, Card, Badge, Empty, human, money, dt, Table } from '../components/ui';

const MONEY = ['todaysRevenue', 'outstandingBalance', 'totalCollectedToday'];
const TITLES = { super_admin: 'Platform overview', manager: 'Hospital overview', receptionist: 'Front desk', cashier: 'Cashier desk', doctor: 'My day', lab: 'Laboratory', xray: 'X-Ray department', pharmacist: 'Pharmacy' };

export default function Dashboard() {
  const { user, hospital } = useAuth();
  const url = user.role === 'super_admin' ? '/hospitals/stats' : '/dashboard';
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', user.role], queryFn: () => get(url), refetchInterval: 30_000 });
  const cur = hospital?.settings?.currency || 'USD';
  return (
    <>
      <PageHeader title={TITLES[user.role]} subtitle={`Welcome, ${user.name}`} />
      {isLoading ? <Loading /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Object.entries(data || {}).map(([k, v]) => <Stat key={k} label={human(k)} value={MONEY.includes(k) ? money(v, cur) : v} />)}
        </div>
      )}
      {user.role === 'doctor' && <Queue />}
    </>
  );
}

export function Queue() {
  const { data, isLoading } = useQuery({ queryKey: ['queue'], queryFn: () => get('/visits', { today: 'true' }), refetchInterval: 15_000 });
  return (
    <Card title="Today’s patient queue" className="mt-6">
      {isLoading ? <Loading /> : !data?.length ? <Empty>No patients assigned to you today.</Empty> : (
        <Table head={['Patient ID', 'Patient', 'Visit', 'Arrived', 'Status', '']}>
          {data.map((v) => (
            <tr key={v._id}>
              <td className="td font-medium">{v.patient.patientId}</td><td className="td">{v.patient.fullName}<div className="text-xs text-slate-500">{v.patient.age}y · {v.patient.gender}</div></td>
              <td className="td">#{v.visitNo}</td><td className="td">{dt(v.visitDate)}</td><td className="td"><Badge value={v.status} /></td>
              <td className="td text-right"><Link className="btn-primary btn-sm" to={`/doctor/consult/${v._id}`}>{v.status === 'waiting' ? 'Start consultation' : 'Open'}</Link></td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
