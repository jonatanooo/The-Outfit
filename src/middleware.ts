import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Por ahora solo redirige si no hay cookie de Supabase (básico)
    // La protección real se hace en el useEffect de cada página
    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};