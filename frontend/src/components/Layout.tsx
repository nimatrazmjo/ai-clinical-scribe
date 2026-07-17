import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, Stethoscope } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/features/auth/AuthContext';
import { UserRole } from '@contracts';
import { cn } from '@/lib/cn';

interface LayoutProps {
  children: ReactNode;
  userName?: string;
  onLogout?: () => void;
}

export function Layout({ children, userName, onLogout }: LayoutProps) {
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const { user } = useAuth();

  const navLinks = [
    { to: '/encounters', label: 'Encounters' },
    ...(user?.role === UserRole.Admin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 h-12 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Stethoscope size={18} className="text-primary" aria-hidden="true" />
          <span className="font-semibold text-sm tracking-tight">Kyron Scribe</span>
          <nav aria-label="Main navigation" className="ml-4 flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-3 py-1 rounded text-sm transition-colors',
                  pathname.startsWith(link.to)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={toggle}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
          {userName && (
            <span className="text-xs text-muted-foreground border-l border-border pl-2 ml-1">
              {userName}
            </span>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
