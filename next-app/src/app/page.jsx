'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/StateDisplays';
import { useAuth } from '@/context/Providers';
export default function HomePage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (loading)
            return;
        if (!user)
            router.replace('/login');
        else if (user.role === 'ADMIN')
            router.replace('/admin');
        else if (user.role === 'WARDEN')
            router.replace('/warden');
        else
            router.replace('/dashboard');
    }, [user, loading, router]);
    return <LoadingSpinner label="Starting HostelSwap..."/>;
}
