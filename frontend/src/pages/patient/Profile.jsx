import { useEffect, useState } from 'react';
import { ErrorState, Field, LoadingBlock, PageHeader, Select, Spinner } from '../../components/ui';
import { useAction, useFetch } from '../../hooks/useApi';
import { authApi, patientsApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BLOOD_GROUPS, GENDERS } from '../../utils/constants';

const FIELDS = [
  'fullName',
  'phone',
  'email',
  'dateOfBirth',
  'gender',
  'bloodGroup',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'allergies',
];

export default function PatientProfile() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const { busy, run } = useAction();

  const patientId = profile?.id;
  const { data, loading, error, reload } = useFetch(() => patientsApi.get(patientId), [patientId], {
    skip: !patientId,
  });

  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    if (!data?.data) return;
    const next = {};
    FIELDS.forEach((key) => {
      next[key] = data.data[key] ?? '';
    });
    setForm(next);
  }, [data]);

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submitProfile = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.fullName || form.fullName.trim().length < 2) next.fullName = 'Enter your full name';
    if (!form.phone || form.phone.trim().length < 6) next.phone = 'Enter a valid phone number';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email';
    setErrors(next);
    if (Object.keys(next).length) return;

    await run(async () => {
      try {
        await patientsApi.update(patientId, {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          bloodGroup: form.bloodGroup || 'Unknown',
          address: form.address || undefined,
          emergencyContactName: form.emergencyContactName || undefined,
          emergencyContactPhone: form.emergencyContactPhone || undefined,
          allergies: form.allergies || undefined,
        });
        toast.success('Profile updated');
        await refreshProfile();
        reload();
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    const next = {};
    if (!passwordForm.currentPassword) next.currentPassword = 'Enter your current password';
    if (passwordForm.newPassword.length < 8) next.newPassword = 'Use at least 8 characters';
    if (passwordForm.newPassword !== passwordForm.confirm) next.confirm = 'Passwords do not match';
    setPasswordErrors(next);
    if (Object.keys(next).length) return;

    await run(async () => {
      try {
        await authApi.changePassword({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        });
        toast.success('Password updated');
        setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      } catch (err) {
        toast.error(err.message);
      }
    });
  };

  if (!patientId) {
    return <ErrorState message="No patient profile is linked to this account." />;
  }
  if (loading) return <LoadingBlock label="Loading your profile…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="My profile"
        description={`Patient ID ${data.data.patientCode}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submitProfile} noValidate className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title">Personal details</h2>
          </div>
          <div className="card-body grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.fullName}>
              <input className="input" value={form.fullName || ''} onChange={update('fullName')} />
            </Field>
            <Field label="Phone" required error={errors.phone}>
              <input className="input" value={form.phone || ''} onChange={update('phone')} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input
                type="email"
                className="input"
                value={form.email || ''}
                onChange={update('email')}
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                className="input"
                max={new Date().toISOString().slice(0, 10)}
                value={form.dateOfBirth || ''}
                onChange={update('dateOfBirth')}
              />
            </Field>
            <Field label="Gender">
              <Select
                options={GENDERS}
                placeholder="Not specified"
                value={form.gender || ''}
                onChange={update('gender')}
              />
            </Field>
            <Field label="Blood group">
              <Select
                options={BLOOD_GROUPS}
                value={form.bloodGroup || 'Unknown'}
                onChange={update('bloodGroup')}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <input className="input" value={form.address || ''} onChange={update('address')} />
              </Field>
            </div>
            <Field label="Emergency contact name">
              <input
                className="input"
                value={form.emergencyContactName || ''}
                onChange={update('emergencyContactName')}
              />
            </Field>
            <Field label="Emergency contact phone">
              <input
                className="input"
                value={form.emergencyContactPhone || ''}
                onChange={update('emergencyContactPhone')}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Allergies">
                <input
                  className="input"
                  value={form.allergies || ''}
                  onChange={update('allergies')}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy && <Spinner className="h-4 w-4 text-white" />}
                Save changes
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Medical history</h2>
            </div>
            <div className="card-body text-sm text-slate-600">
              <p>{data.data.medicalHistory || 'No medical history recorded yet.'}</p>
              <p className="mt-3 text-xs text-slate-500">
                Medical history is maintained by your care team and cannot be edited here.
              </p>
            </div>
          </div>

          <form onSubmit={submitPassword} noValidate className="card">
            <div className="card-header">
              <h2 className="card-title">Change password</h2>
            </div>
            <div className="card-body space-y-4">
              <Field label="Current password" required error={passwordErrors.currentPassword}>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                />
              </Field>
              <Field label="New password" required error={passwordErrors.newPassword}>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                />
              </Field>
              <Field label="Confirm new password" required error={passwordErrors.confirm}>
                <input
                  type="password"
                  className="input"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                />
              </Field>
              <button type="submit" className="btn-secondary w-full" disabled={busy}>
                Update password
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
