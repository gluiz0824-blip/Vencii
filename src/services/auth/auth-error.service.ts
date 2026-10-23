interface AuthFailure {
  code?: string;
  status?: number;
}

const signUpErrorMessages: Record<string, string> = {
  user_already_exists:
    "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  email_exists:
    "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  email_address_invalid:
    "O provedor de autenticação recusou este endereço de e-mail.",
  weak_password:
    "A senha foi recusada pelo provedor. Use uma senha mais forte.",
  signup_disabled: "Novos cadastros estão desabilitados no Supabase.",
  over_email_send_rate_limit:
    "Muitos e-mails de confirmação foram enviados. Aguarde alguns minutos antes de tentar novamente.",
  over_request_rate_limit:
    "Muitas tentativas foram feitas deste dispositivo. Aguarde alguns minutos e tente novamente.",
};

export function getSignUpErrorMessage(error: AuthFailure): string {
  const mappedMessage = error.code
    ? signUpErrorMessages[error.code]
    : undefined;
  if (mappedMessage) return mappedMessage;

  if (error.status === 429) {
    return "O limite temporário de tentativas do Supabase foi atingido. Aguarde alguns minutos.";
  }

  if (error.status && error.status >= 500) {
    return "O Supabase não conseguiu salvar o usuário. Verifique as migrations e os logs de autenticação.";
  }

  return "Não foi possível criar sua conta. Verifique os dados e tente novamente.";
}
