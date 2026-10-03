import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import { PageHeader, Card, Table, Badge, Empty, Loading, dt } from '../components/ui';
export default function ReceptionVisits() {
  const { data, isLoading } = useQuery({ queryKey: ['visits-today'], queryFn: () => get('/visits', { today: 'true' }), refetchInterval: 15_000 });
  return (<><PageHeader title="Today’s visits" /><Card>{isLoading ? <Loading /> : !data?.length ? <Empty>No visits yet today.</Empty> : (
    <Table head={['Arrived', 'Patient ID', 'Patient', 'Department', 'Doctor', 'Visit', 'Status']}>{data.map((v) => <tr key={v._id}><td className="td">{dt(v.visitDate)}</td><td className="td font-medium">{v.patient?.patientId}</td><td className="td">{v.patient?.fullName}</td><td className="td">{v.department?.name}</td><td className="td">{v.doctor?.name}</td><td className="td">#{v.visitNo}</td><td className="td"><Badge value={v.status} /></td></tr>)}</Table>
  )}</Card></>);
}
