import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Field, Select, Spinner } from '../../components/ui';
import { GENDERS, ROLE_HOME } from '../../utils/constants';

const INITIAL = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
};

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'Use at least 8 characters';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      next.password = 'Include at least one letter and one number';
    }
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
    if (form.phone && form.phone.trim().length < 6) next.phone = 'Enter a valid phone number';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setBusy(true);
    try {
      const user = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        address: form.address.trim() || undefined,
      });
      toast.success('Account created. Welcome!');
      navigate(ROLE_HOME[user.role] || '/', { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Create a patient account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Staff accounts are created by an administrator.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6">
          {serverError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {serverError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.fullName}>
              <input className="input" value={form.fullName} onChange={update('fullName')} />
            </Field>

            <Field label="Email address" required error={errors.email}>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={update('email')}
                autoComplete="email"
              />
            </Field>

            <Field
              label="Password"
              required
              error={errors.password}
              hint="Minimum 8 characters, with a letter and a number"
            >
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={update('password')}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm password" required error={errors.confirmPassword}>
              <input
                type="password"
                className="input"
                value={form.confirmPassword}
                onChange={update('confirmPassword')}
                autoComplete="new-password"
              />
            </Field>

            <Field label="Phone" error={errors.phone}>
              <input className="input" value={form.phone} onChange={update('phone')} />
            </Field>

            <Field label="Date of birth">
              <input
                type="date"
                className="input"
                max={new Date().toISOString().slice(0, 10)}
                value={form.dateOfBirth}
                onChange={update('dateOfBirth')}
              />
            </Field>

            <Field label="Gender">
              <Select
                options={GENDERS}
                placeholder="Select gender"
                value={form.gender}
                onChange={update('gender')}
              />
            </Field>

            <Field label="Address">
              <input className="input" value={form.address} onChange={update('address')} />
            </Field>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />}
            {busy ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-brand-700 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
