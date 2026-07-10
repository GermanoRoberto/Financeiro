import { supabase } from './supabaseClient';
import { Usuario } from './types';

const AUTHORIZED_EMAILS = (process.env.NEXT_PUBLIC_AUTHORIZED_EMAILS || '').split(',').map(e => e.trim());

export async function verificarAcessoAutorizado(email: string): Promise<boolean> {
  return AUTHORIZED_EMAILS.includes(email.toLowerCase());
}

export async function obterOuCriarUsuario(email: string, nome: string): Promise<Usuario | null> {
  try {
    // Verificar autorização
    const autorizado = await verificarAcessoAutorizado(email);
    if (!autorizado) {
      throw new Error('Email não autorizado para acessar o sistema');
    }

    // Obter user_id atual do auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    // Buscar ou criar registro em usuarios_permitidos
    const { data: usuarioExistente, error: erroFetch } = await supabase
      .from('usuarios_permitidos')
      .select('*')
      .eq('email', email)
      .single();

    if (erroFetch && erroFetch.code !== 'PGRST116') {
      throw erroFetch;
    }

    if (usuarioExistente) {
      // Atualizar user_id se não estiver preenchido
      if (!usuarioExistente.user_id) {
        const { data: usuarioAtualizado, error: erroUpdate } = await supabase
          .from('usuarios_permitidos')
          .update({ user_id: user.id })
          .eq('id', usuarioExistente.id)
          .select()
          .single();
        
        if (erroUpdate) throw erroUpdate;
        return usuarioAtualizado as Usuario;
      }
      return usuarioExistente as Usuario;
    }

    // Criar novo registro
    const { data: novoUsuario, error: erroCriacao } = await supabase
      .from('usuarios_permitidos')
      .insert([
        {
          email,
          nome,
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (erroCriacao) throw erroCriacao;
    return novoUsuario as Usuario;
  } catch (error: any) {
    console.error('Erro ao obter/criar usuário:', error.message);
    return null;
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
