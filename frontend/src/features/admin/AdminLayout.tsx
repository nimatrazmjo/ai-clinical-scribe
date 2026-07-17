import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/cn';

const tabs = [
  { to: '/admin/encounters', label: 'Encounters' },
  { to: '/admin/templates', label: 'Templates' },
  { to: '/admin/providers', label: 'Providers' },
];

export function AdminLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-base font-semibold mb-4">Admin</h1>
        <nav className="flex border-b border-border gap-4" aria-label="Admin sections">
          {tabs.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'pb-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
