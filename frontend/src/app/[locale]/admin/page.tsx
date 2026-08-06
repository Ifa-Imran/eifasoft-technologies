'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';

export default function AdminIndexPage() {
  const router = useRouter();
  const tAdmin = useTranslations('admin');

  useEffect(() => {
    router.replace('/admin/staking-volume');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-surface-500 text-sm">{tAdmin('redirecting')}</p>
      </div>
    </div>
  );
}
