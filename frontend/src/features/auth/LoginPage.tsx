import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useAuthApi } from './useAuthApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isLoading, doLogin } = useAuthApi();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && user) navigate('/encounters', { replace: true });
  }, [user, authLoading, navigate]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email) next.email = 'Email is required';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const ok = await doLogin(email, password);
    if (!ok) {
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <Stethoscope size={20} className="text-primary" aria-hidden="true" />
          <span className="font-semibold text-base tracking-tight">Kyron Scribe</span>
        </div>

        <h1 className="text-lg font-semibold mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your credentials to access the clinical workspace.
        </p>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={cn(
                'h-8 rounded border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                errors.email ? 'border-destructive' : 'border-input',
              )}
            />
            {errors.email && (
              <span id="email-error" role="alert" className="text-xs text-destructive">
                {errors.email}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              ref={passwordRef}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              className={cn(
                'h-8 rounded border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
                errors.password ? 'border-destructive' : 'border-input',
              )}
            />
            {errors.password && (
              <span id="password-error" role="alert" className="text-xs text-destructive">
                {errors.password}
              </span>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="mt-2 w-full">
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
