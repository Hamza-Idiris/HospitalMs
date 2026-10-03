import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth, HOME } from '../auth';
import { errMsg } from '../api';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();
  if (user) return <Navigate to={HOME[user.role]} replace />;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="text-lg font-bold">Hospital Management System</div>
        <div>
          <p className="max-w-md text-3xl font-bold leading-tight">One patient record, from the front desk to the pharmacy.</p>
          <p className="mt-4 max-w-md text-slate-300">Registration, consultation, payments, laboratory, X-ray and dispensing in one connected workflow — separate and private for every hospital.</p>
        </div>
        <div className="text-sm text-slate-400">Every action is recorded in the audit log.</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form className="w-full max-w-sm space-y-4" onSubmit={handleSubmit(async (d) => { setError(''); try { const u = await login(d.email, d.password); nav(HOME[u.role], { replace: true }); } catch (e) { setError(errMsg(e)); } })}>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <label className="block"><span className="mb-1 block text-sm font-medium">Email</span><input className="input" type="email" autoComplete="username" {...register('email', { required: true })} /></label>
          <label className="block"><span className="mb-1 block text-sm font-medium">Password</span><input className="input" type="password" autoComplete="current-password" {...register('password', { required: true })} /></label>
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
          <p className="text-xs text-slate-500">Forgot your password? Ask your hospital manager to reset it for you.</p>
        </form>
      </div>
    </div>
  );
}
