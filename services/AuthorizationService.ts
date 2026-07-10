import { supabase } from '@/lib/supabaseClient';
import { Usuario } from '@/lib/types';

export class AuthorizationService {
  static async verificarAcesso(_email?: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      
      const response = await fetch('/api/auth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) return false;
      const data = await response.json();
      return data.authorized === true;
    } catch (e) {
      console.error('Erro ao verificar acesso:', e);
      return false;
    }
  }

  static async obterUsuario(_email?: string, _nome?: string): Promise<Usuario | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const response = await fetch('/api/auth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      if (data.authorized && data.user) {
        return data.user as Usuario;
      }
      return null;
    } catch (e) {
      console.error('Erro ao obter usuário:', e);
      return null;
    }
  }
}
