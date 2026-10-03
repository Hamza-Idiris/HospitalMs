import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, HOME } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientSearch from './pages/PatientSearch';
import RegisterPatient from './pages/RegisterPatient';
import PatientProfile from './pages/PatientProfile';
import ReceptionVisits from './pages/ReceptionVisits';
import { PendingPayments, PaymentHistory } from './pages/Cashier';
import Consultation from './pages/Consultation';
import { FollowUps, DoctorOrders } from './pages/DoctorLists';
import TechOrders from './pages/TechOrders';
import Pharmacy from './pages/Pharmacy';
import { Departments, Staff, Services, Reports } from './pages/Manager';
import { Hospitals, AuditLogs } from './pages/Admin';

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-10 text-center text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}
const G = (roles, el) => <Guard roles={roles}>{el}</Guard>;

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/admin" element={G(['super_admin'], <Dashboard />)} />
        <Route path="/admin/hospitals" element={G(['super_admin'], <Hospitals />)} />
        <Route path="/admin/audit" element={G(['super_admin'], <AuditLogs />)} />

        <Route path="/manager" element={G(['manager'], <Dashboard />)} />
        <Route path="/manager/patients" element={G(['manager'], <PatientSearch title="Patients" />)} />
        <Route path="/manager/staff" element={G(['manager'], <Staff />)} />
        <Route path="/manager/departments" element={G(['manager'], <Departments />)} />
        <Route path="/manager/services" element={G(['manager'], <Services />)} />
        <Route path="/manager/payments" element={G(['manager'], <PaymentHistory manager />)} />
        <Route path="/manager/reports" element={G(['manager'], <Reports />)} />
        <Route path="/manager/audit" element={G(['manager'], <AuditLogs />)} />

        <Route path="/cashier" element={G(['cashier'], <Dashboard />)} />
        <Route path="/cashier/register" element={G(['cashier'], <RegisterPatient />)} />
        <Route path="/cashier/patients" element={G(['cashier'], <PatientSearch />)} />
        <Route path="/cashier/visits" element={G(['cashier'], <ReceptionVisits />)} />
        <Route path="/cashier/pending" element={G(['cashier'], <PendingPayments />)} />
        <Route path="/cashier/history" element={G(['cashier'], <PaymentHistory />)} />

        <Route path="/doctor" element={G(['doctor'], <Dashboard />)} />
        <Route path="/doctor/patients" element={G(['doctor'], <PatientSearch title="My patients" />)} />
        <Route path="/doctor/consult/:visitId" element={G(['doctor'], <Consultation />)} />
        <Route path="/doctor/orders" element={G(['doctor'], <DoctorOrders />)} />
        <Route path="/doctor/follow-ups" element={G(['doctor'], <FollowUps />)} />

        <Route path="/laboratory" element={G(['lab'], <><Dashboard /><div className="mt-8"><TechOrders kind="lab" /></div></>)} />
        <Route path="/xray" element={G(['xray'], <><Dashboard /><div className="mt-8"><TechOrders kind="xray" /></div></>)} />
        <Route path="/pharmacy" element={G(['pharmacist'], <><Dashboard /><div className="mt-8"><Pharmacy /></div></>)} />

        <Route path="/patients/:id" element={G(['manager', 'doctor', 'cashier', 'lab', 'xray', 'pharmacist'], <PatientProfile />)} />
      </Route>
      <Route path="*" element={loading ? null : <Navigate to={user ? HOME[user.role] : '/login'} replace />} />
    </Routes>
  );
}
