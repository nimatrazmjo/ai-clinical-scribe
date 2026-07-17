import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEncounter } from '@/api/encounters';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/api/apiClient';
import { cn } from '@/lib/cn';

interface FormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

const MIN_DOB = new Date();
MIN_DOB.setFullYear(MIN_DOB.getFullYear() - 120);

function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (!values.firstName.trim()) {
    errors.firstName = 'First name is required';
  }
  if (!values.lastName.trim()) {
    errors.lastName = 'Last name is required';
  }
  if (!values.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required';
  } else {
    const dob = new Date(values.dateOfBirth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dob >= today) {
      errors.dateOfBirth = 'Date of birth must be in the past';
    } else if (dob < MIN_DOB) {
      errors.dateOfBirth = 'Date of birth is implausibly old';
    }
  }

  return errors;
}

function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {error && (
        <span id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

const inputCls = (err?: string) =>
  cn(
    'h-8 rounded border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
    err ? 'border-destructive' : 'border-input',
  );

export function StartEncounterPage() {
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [values, setValues] = useState<FormValues>({ firstName: '', lastName: '', dateOfBirth: '' });
  const [errors, setErrors] = useState<FormErrors>({});

  function set(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next = validateForm(values);
    setErrors(next);
    if (hasErrors(next)) return;

    setIsLoading(true);
    try {
      const enc = await createEncounter({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dateOfBirth: values.dateOfBirth,
      });
      navigate(`/encounters/${enc.id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to start encounter. Please try again.';
      toastError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-base font-semibold mb-4">New encounter</h1>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field id="firstName" label="First name" error={errors.firstName}>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? 'firstName-error' : undefined}
            className={inputCls(errors.firstName)}
          />
        </Field>

        <Field id="lastName" label="Last name" error={errors.lastName}>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? 'lastName-error' : undefined}
            className={inputCls(errors.lastName)}
          />
        </Field>

        <Field id="dateOfBirth" label="Date of birth" error={errors.dateOfBirth}>
          <input
            id="dateOfBirth"
            type="date"
            value={values.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            aria-invalid={!!errors.dateOfBirth}
            aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined}
            className={inputCls(errors.dateOfBirth)}
          />
        </Field>

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => navigate('/encounters')}
            className="h-8 px-3 rounded border border-input bg-background text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="h-8 px-3 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {isLoading ? 'Starting…' : 'Start encounter'}
          </button>
        </div>
      </form>
    </div>
  );
}
