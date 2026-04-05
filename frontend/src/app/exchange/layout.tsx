import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RegistrationGuard } from '@/components/auth/RegistrationGuard';

export default function ExchangeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardLayout>
      <RegistrationGuard>{children}</RegistrationGuard>
    </DashboardLayout>
  );
}
