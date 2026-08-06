import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Orbitron, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Providers } from '@/providers';
import { getDir, isLocale, locales } from '@/i18n/config';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

/** Pre-render every locale at build time. */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/** SEO metadata + hreflang alternates, driven by translations. */
export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const active = isLocale(locale) ? locale : 'en';
  const t = await getTranslations({ locale: active, namespace: 'metadata' });

  const languages: Record<string, string> = {};
  for (const l of locales) {
    languages[l] = `/${l}`;
  }

  return {
    title: t('title'),
    description: t('description'),
    icons: { icon: '/favicon.ico' },
    alternates: {
      canonical: `/${active}`,
      languages,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: 'KAIRO DAO',
      locale: t('ogLocale'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate the locale segment; unknown locales 404 (middleware also guards).
  if (!isLocale(locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = getDir(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${orbitron.variable} ${jetbrainsMono.variable} font-inter min-h-screen bg-surface-50`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
