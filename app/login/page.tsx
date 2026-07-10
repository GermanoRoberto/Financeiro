'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

interface LoginPageProps {
  onLoginSuccess: (email: string, nome: string) => Promise<void>;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  useEffect(() => {
    // Listener para quando o usuário se autentica
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          const email = session.user.email;
          const nome = session.user.user_metadata?.name || session.user.email;
          await onLoginSuccess(email, nome);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">💰 Financeiro</h1>
          <p className="text-gray-600 mt-2">Controle financeiro do casal</p>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#3b82f6',
                  brandAccent: '#1e40af',
                },
              },
            },
          }}
          providers={['google']}
          redirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/`}
        />
      </div>
    </div>
  );
}
