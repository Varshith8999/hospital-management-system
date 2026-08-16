import { useEffect, useMemo, useState } from 'react';
import { Field, Modal, Select, Spinner } from '../../components/ui';
import { appointmentsApi, departmentsApi, doctorsApi, patientsApi } from '../../api/endpoints';
import { useFetch } from '../../hooks/useApi';
import { useToast } from '../../context/ToastContext';
import { todayISO } from '../../utils/format';

const EMPTY = {
  patientId: '',
  departmentId: '',
  doctorId: '',
  appointmentDate: '',
  appointmentTime: '',
  reason: '',
};

/**
 * Shared booking dialog.
 * `requirePatient` = staff booking on behalf of someone (patient picker shown).
 * Patients booking for themselves omit patientId - the API forces their own id.
 */
export default function BookAppointmentModal({ open, onClose, onBooked, requirePatient = false }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const departments = useFetch(() => departmentsApi.list({ limit: 100 }), [open], { skip: !open });
  const doctors = useFetch(
    () => doctorsApi.list({ limit: 100, departmentId: form.departmentId || undefined }),
    [open, form.departmentId],
    { skip: !open }
  );
  const patients = useFetch(() => patientsApi.list({ limit: 100 }), [open], {
    skip: !open || !requirePatient,
  });

  const slots = useFetch(
    () => doctorsApi.slots(form.doctorId, form.appointmentDate),
    [form.doctorId, form.appointmentDate],
    { skip: !open || !form.doctorId || !form.appointmentDate }
  );

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErrors({});
    }
  }, [open]);

  const update = (key) => (e) => {
    const { value } = e.target;
    setForm((f) => ({
      ...f,
      [key]: value,
      // Changing the department invalidates the chosen doctor.
      ...(key === 'departmentId' ? { doctorId: '' } : {}),
    }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const freeSlots = useMemo(
    () => (slots.data?.data?.slots || []).filter((s) => s.available).map((s) => s.time),
    [slots.data]
  );

  const validate = () => {
    const next = {};
    if (requirePatient && !form.patientId) next.patientId = 'Select a patient';
    if (!form.doctorId) next.doctorId = 'Select a doctor';
    if (!form.appointmentDate) next.appointmentDate = 'Pick a date';
    else if (form.appointmentDate < todayISO()) next.appointmentDate = 'Pick a future date';
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(form.appointmentTime)) {
      next.appointmentTime = 'Pick a time';
    }
    if (form.reason.trim().length < 3) next.reason = 'Describe the reason for the visit';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    try {
      await appointmentsApi.book({
        ...(requirePatient ? { patientId: Number(form.patientId) } : {}),
        doctorId: Number(form.doctorId),
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        reason: form.reason.trim(),
      });
      toast.success('Appointment booked');
      onBooked?.();
    } catch (err) {
      // Surfaces the backend's double-booking conflict verbatim.
      toast.error(err.message);
      setErrors((prev) => ({ ...prev, appointmentTime: err.message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Book an appointment"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="book-form" className="btn-primary" disabled={busy}>
            {busy && <Spinner className="h-4 w-4 text-white" />}
            {busy ? 'Booking…' : 'Book appointment'}
          </button>
        </>
      }
    >
      <form id="book-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {requirePatient && (
          <Field label="Patient" required error={errors.patientId}>
            <Select
              placeholder={patients.loading ? 'Loading patients…' : 'Select a patient'}
              options={(patients.data?.data || []).map((p) => ({
                value: p.id,
                label: `${p.fullName} (${p.patientCode})`,
              }))}
              value={form.patientId}
              onChange={update('patientId')}
            />
          </Field>
        )}

        <Field label="Department" hint="Optional - filters the doctor list">
          <Select
            placeholder="All departments"
            options={(departments.data?.data || []).map((d) => ({ value: d.id, label: d.name }))}
            value={form.departmentId}
            onChange={update('departmentId')}
          />
        </Field>

        <Field label="Doctor" required error={errors.doctorId}>
          <Select
            placeholder={doctors.loading ? 'Loading doctors…' : 'Select a doctor'}
            options={(doctors.data?.data || [])
              .filter((d) => d.isAvailable)
              .map((d) => ({
                value: d.id,
                label: `${d.fullName} — ${d.specialization}`,
              }))}
            value={form.doctorId}
            onChange={update('doctorId')}
          />
        </Field>

        <Field label="Date" required error={errors.appointmentDate}>
          <input
            type="date"
            className="input"
            min={todayISO()}
            value={form.appointmentDate}
            onChange={update('appointmentDate')}
          />
        </Field>

        <Field
          label="Time"
          required
          error={errors.appointmentTime}
          hint={
            form.doctorId && form.appointmentDate
              ? slots.loading
                ? 'Checking availability…'
                : freeSlots.length
                  ? `Free slots: ${freeSlots.join(', ')}`
                  : 'No published slots for that day — you can still enter a time.'
              : 'Pick a doctor and date to see free slots'
          }
        >
          <input
            type="time"
            className="input"
            value={form.appointmentTime}
            onChange={update('appointmentTime')}
            list="free-slot-list"
          />
          <datalist id="free-slot-list">
            {freeSlots.map((time) => (
              <option key={time} value={time} />
            ))}
          </datalist>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Reason for visit" required error={errors.reason}>
            <textarea
              className="input min-h-[90px]"
              value={form.reason}
              onChange={update('reason')}
              placeholder="Describe the symptoms or purpose of the visit"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
