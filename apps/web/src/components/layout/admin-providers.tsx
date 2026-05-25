'use client';

import { NavigationGuardProvider } from '@/lib/navigation-guard';

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return (
    <NavigationGuardProvider>
      {children}
    </NavigationGuardProvider>
  );
}
