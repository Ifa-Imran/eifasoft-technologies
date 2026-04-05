import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RegistrationGuard } from '@/components/auth/RegistrationGuard';

export default function RankLayout({
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
