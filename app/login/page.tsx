'use client';

import LoginPage from '@/components/LoginPage';
import { useRouter } from 'next/navigation';

export default function LoginRoute() {
  const router = useRouter();

  const handleLoginSuccess = async () => {
    router.push('/');
  };

  return <LoginPage onLoginSuccess={handleLoginSuccess} />;
}
