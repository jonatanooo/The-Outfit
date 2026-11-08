"use client";
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function WinterSeasonRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const generoParam = (searchParams.get('genero') || searchParams.get('gender') || 'mujer').toLowerCase();
  const esHombre = generoParam === 'hombre' || generoParam === 'hombres' || generoParam === '57';

  useEffect(() => {
    router.replace(esHombre ? '/productos-hombre/winter-season' : '/productos/winter-season');
  }, [esHombre, router]);

  return null;
}

export default function WinterSeasonPage() {
  return (
    <Suspense fallback={null}>
      <WinterSeasonRedirectContent />
    </Suspense>
  );
}
