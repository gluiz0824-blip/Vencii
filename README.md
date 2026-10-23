# Vencii

Fundação de um SaaS B2B para organizar boletos, contas a pagar, vencimentos, fornecedores, aprovações e comprovantes de pequenas empresas brasileiras.

> A Vencii não executa pagamentos, não funciona como banco e não substitui um ERP contábil.

## Stack

- Next.js 16.2 com App Router, React 19 e TypeScript strict
- Tailwind CSS 4 e componentes shadcn/ui
- Supabase (PostgreSQL, Auth, RLS e Storage privado)
- React Hook Form + Zod
- date-fns, Recharts e Lucide React
- ESLint, Prettier, Vitest, Playwright e pgTAP

TanStack Query ainda não foi instalado porque não existe estado remoto no cliente que justifique cache. Os dados começam em Server Components e entram no cliente apenas quando houver interação real.

## Requisitos

- Node.js 24 LTS ou versão suportada pelo Next.js 16.2
- npm 11+
- Docker Desktop para a stack local do Supabase
- Supabase CLI (instalado como dependência de desenvolvimento)

## Instalação

```bash
npm install
copy .env.example .env.local
npm run supabase:start
npm run db:reset
npm run dev
```

Após `supabase start`, substitua em `.env.local` a URL e a publishable/anon key pelos valores locais exibidos pelo CLI. A aplicação fica em `http://localhost:3000` e o Supabase Studio local, por padrão, em `http://localhost:54323`.

Sem as variáveis do Supabase, as rotas públicas e `/health` continuam disponíveis, mas autenticação e área protegida não funcionam.

## Variáveis de ambiente

| Variável                               | Obrigatória para      | Descrição                             |
| -------------------------------------- | --------------------- | ------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | links de autenticação | URL pública da aplicação              |
| `NEXT_PUBLIC_SUPABASE_URL`             | autenticação e dados  | URL do projeto Supabase               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | autenticação e dados  | chave publicável do projeto           |
| `DOCUMENT_MAX_SIZE_MB`                 | upload de documentos  | limite entre 1 e 10 MB                |
| `SUPABASE_SERVICE_ROLE_KEY`            | jobs no servidor      | chave secreta, nunca pública          |
| `CRON_SECRET`                          | rota do agendador     | segredo com 32+ caracteres            |
| `EMAIL_PROVIDER`                       | lembretes por e-mail  | `local` ou `resend`                   |
| `EMAIL_FROM`                           | lembretes por e-mail  | remetente verificado                  |
| `RESEND_API_KEY`                       | provedor Resend       | obrigatória no modo `resend`          |
| `INBOUND_EMAIL_PROVIDER`               | caixa por e-mail      | `disabled`, `local` ou `generic_hmac` |
| `INBOUND_EMAIL_DOMAIN`                 | endereço de entrada   | domínio que recebe os encaminhamentos |
| `INBOUND_WEBHOOK_SECRET`               | webhook de entrada    | segredo HMAC com 32+ caracteres       |
| `INBOUND_MAX_ATTACHMENTS`              | webhook de entrada    | limite de 1 a 20 anexos por mensagem  |

As variáveis são validadas com Zod quando a integração é usada. Nunca exponha a service role key no navegador nem a adicione ao `.env.example`.

## Banco multiempresa

As migrations versionadas estão em `supabase/migrations` e criam:

- `profiles`: perfil vinculado a `auth.users`;
- `organizations`: empresa, preferências e `owner_id`;
- `organization_members`: associação, status e papel (`owner`, `admin`, `approver`, `operator`, `viewer`);
- `organization_invitations`: convites com apenas o SHA-256 do token persistido;
- `audit_logs`: trilha imutável por organização, sem expor o hash dos convites.

RLS está ativa em todas essas tabelas. As policies consultam funções `security definer` no schema não exposto `private`, evitando recursão em `organization_members`. Somente membros com status `active` enxergam a própria organização. Alterações administrativas exigem `owner` ou `admin`; triggers impedem remover ou rebaixar o owner e exigem o RPC transacional `transfer_organization_ownership` para transferências.

O onboarding usa `complete_onboarding`, que atualiza o perfil, cria a empresa e associa o usuário como `owner` na mesma transação. O aceite usa `accept_organization_invitation`, que bloqueia token inválido, expirado, já utilizado ou destinado a outro e-mail.

## Autenticação e organizações

Estão disponíveis cadastro, login, logout, recuperação e redefinição de senha. O proxy renova a sessão do Supabase, mas a autorização é refeita no servidor e no PostgreSQL. `/app` exige simultaneamente uma sessão válida, pelo menos uma associação ativa e uma organização ativa autorizada no cookie HTTP-only.

Usuários sem empresa são enviados ao onboarding em três etapas. Usuários com mais de uma empresa escolhem a organização antes de entrar e podem trocá-la pelo header.

## Design system autenticado

Os tokens globais ficam em `src/app/globals.css` e cobrem superfícies, tipografia, raios, sombras, espaçamento do painel e estados financeiros sem depender apenas de cor. Os estados disponíveis incluem pendente, aguardando aprovação, aprovado, pago parcialmente, pago, vencido, cancelado e rejeitado.

Os componentes de produto ficam em `src/components/product`, incluindo cabeçalho de página, métricas, badges de status, estados vazio/erro/sucesso/loading, moeda, data de negócio, tabela base, confirmação, layout de formulário e guard de permissão. A tabela oferece filtro, ordenação, paginação e semântica de teclado sem exigir dados demonstrativos em produção.

A sidebar é recolhível no desktop e usa drawer no celular. O layout preserva os Server Components das páginas e limita estado client-side ao shell e controles realmente interativos. Storybook e fixtures não foram adicionados porque ainda não existe necessidade de um catálogo isolado.

## Contas a pagar

O módulo central usa `accounts_payable`, com valores inteiros em centavos, vencimentos em `date`, chaves idempotentes por ocorrência e vínculos opcionais com `suppliers` e `expense_categories`. Parcelas e recorrências são materializadas como registros individuais ligados por `recurrence_group_id`; a aplicação mostra uma prévia antes do envio.

A listagem em `/app/contas-a-pagar` pesquisa, filtra, ordena e pagina no servidor. O cadastro fica em `/app/contas-a-pagar/nova`, e cada conta possui detalhes, edição, duplicação e cancelamento com motivo. A interface não executa pagamentos nem altera estados bancários.

Owners e administradores podem registrar pagamentos nos detalhes de uma conta pendente, aprovada, agendada, parcialmente paga ou vencida. Esse fluxo não movimenta dinheiro e exige valor, data/hora e método. A transação passa por `register_account_payment`, bloqueia excesso por padrão, serializa concorrência com `FOR UPDATE`, usa chave idempotente por envio e gera auditoria.

RLS permite leitura a qualquer membro ativo e escrita somente a `owner`, `admin` e `operator`. Triggers impedem mudar dados financeiros de contas parcial ou totalmente pagas, canceladas ou rejeitadas, preservando apenas a edição de observações quando aplicável. `cancel_account_payable` exige motivo, `mark_overdue_accounts` é idempotente e toda inserção ou atualização gera `audit_logs`. A detecção de provável duplicidade compara linha digitável, hash do documento e fornecedor + valor + vencimento, mas permite confirmação explícita de casos legítimos.

## Pagamentos e comprovantes

`payments` preserva cada registro financeiro em centavos, com método, instante, referência, observação, autoria e chave idempotente. A soma de pagamentos não estornados determina o saldo: a conta fica `partial` enquanto houver saldo e `paid` quando for quitada. Pagamentos parciais e tolerância para valores acima do saldo são opt-in em `/app/configuracoes/pagamentos`; mesmo habilitado, o excesso exige confirmação explícita.

Estornos são restritos a `owner` e `admin`, exigem motivo e a confirmação textual `ESTORNAR`. Nenhum pagamento é apagado: `reversed_at`, `reversed_by` e `reversal_reason` permanecem auditáveis, e o status da conta é recalculado na mesma transação. Contas com pagamento não podem ser excluídas nem ter campos financeiros alterados.

Comprovantes reutilizam o bucket privado e `payable_attachments`, agora vinculado opcionalmente por `payment_id`. O banco valida que organização, conta e pagamento correspondem. A interface aceita PDF, PNG ou JPEG, mostra o comprovante na lista do pagamento e gera a visualização somente por URL assinada autorizada. As métricas, previsões, distribuições e calendário usam o saldo ativo; o realizado mensal soma pagamentos não estornados.

## Documentos e extração assistida

O envio em `/app/contas-a-pagar` aceita PDF, PNG e JPEG de até 10 MB. A aplicação confere tamanho, extensão, MIME declarado e assinatura real, calcula SHA-256 antes de armazenar e detecta reenvio dentro da organização. Os objetos usam nomes internos aleatórios no bucket privado `payable-documents`; o nome original fica somente nos metadados sanitizados de `payable_attachments`.

O acesso ao Storage depende das policies que relacionam o objeto ao registro autorizado, não apenas do caminho. A visualização usa URL assinada de curta duração. A extração tenta texto nativo de PDF com `unpdf`, valida dígitos verificadores de linhas bancárias e de concessionárias e grava confiança por campo. Imagens e PDFs sem texto passam pela interface `OcrProvider`; a implementação inicial é indisponível por padrão, mantendo upload e revisão manual funcionais até a configuração de um provedor externo.

O processamento usa os estados `uploaded`, `processing`, `needs_review`, `completed` e `failed`, com no máximo três tentativas e reivindicação idempotente no banco. Nenhum resultado cria conta silenciosamente: a tela lado a lado exige confirmação ou correção e permite criar uma nova conta ou vincular uma existente.

## Dashboard e calendário

O dashboard em `/app` usa funções SQL autorizadas para calcular valores de hoje, próximos 7 e 30 dias, vencidos, aguardando aprovação e pagos no mês. Previsões e distribuições são agregadas no PostgreSQL; a aplicação não transfere todas as contas ao navegador para calcular métricas. Falhas em gráficos, listas ou alertas ficam isoladas no respectivo bloco.

O calendário em `/app/calendario` oferece visualização mensal no desktop e agenda cronológica priorizada no celular. Status, fornecedor, categoria, mês, modo de visualização e dia selecionado permanecem na URL. Datas usam o fuso da organização como datas de negócio, e contas canceladas ou rejeitadas não entram no calendário nem na previsão. O índice parcial `accounts_payable_paid_date_idx` atende o realizado mensal sem ampliar desnecessariamente os índices de contas em aberto.

## Aprovações

A caixa `/app/aprovacoes` permite que `owner`, `admin` e `approver` revisem dados financeiros e documentos antes de aprovar ou rejeitar uma conta. Decisões individuais e em lote passam por RPCs transacionais, bloqueiam a solicitação com `FOR UPDATE`, impedem voto duplicado e registram solicitações e decisões no `audit_logs`. Rejeições exigem justificativa, e pagamentos ficam bloqueados enquanto uma aprovação obrigatória estiver pendente.

As regras ficam em `/app/configuracoes/aprovacoes`. A precedência usa especificidade antes da prioridade: fornecedor, categoria e depois limites de valor; dentro da mesma especificidade, vence a maior prioridade. `required_approvals` é copiado para a solicitação para que alterações posteriores na regra não mudem um processo em andamento. Autoaprovação é desativada por padrão e só pode ser habilitada por `owner` ou `admin`.

Alterar valor, fornecedor ou vencimento de uma conta já aprovada invalida a solicitação anterior e cria outra automaticamente. Notificações internas idempotentes cobrem nova solicitação, decisão, rejeição e proximidade do vencimento. Toda autorização continua protegida por RLS e pelas funções do banco, não apenas pela interface.

## Notificações e lembretes

A central em `/app/notificacoes` reúne vencimentos, aprovações e falhas de extração da organização ativa. O sino do header mostra a quantidade não lida e as notificações recentes. Cada usuário pode configurar canais em `/app/configuracoes/notificacoes`; regras críticas definidas pela empresa permanecem ativas.

O endpoint protegido `/api/cron/reminders` executa `schedule_reminders`, que calcula a data de negócio no timezone de cada organização, cria notificações com chave de deduplicação e persiste entregas de e-mail. A fila usa `FOR UPDATE SKIP LOCKED`, até três tentativas com espera progressiva e ignora membros que deixaram de estar ativos. O `vercel.json` chama o job a cada hora, independentemente de acessos de usuários.

O provedor de e-mail fica atrás de `EmailProvider`. `EMAIL_PROVIDER=local` confirma as entregas localmente sem rede e sem enviar e-mails reais. Em produção, configure `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` e um `EMAIL_FROM` cujo domínio esteja validado. Os templates não incluem linha digitável, código Pix completo ou conteúdo do documento.

Para testar o job local sem enviar mensagens reais, mantenha `EMAIL_PROVIDER=local`, copie a `service_role key` exibida por `npx supabase status` para `.env.local`, defina um `CRON_SECRET` forte, reinicie `npm run dev` e execute no PowerShell:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod http://localhost:3000/api/cron/reminders -Headers $headers
```

O WhatsApp possui apenas uma interface futura de canal; nenhuma automação não oficial é usada.

## Caixa de entrada por e-mail

Cada organização recebe um endereço `contas+<token>@<domínio>` com token aleatório de 192 bits. A página `/app/caixa-de-entrada` permite copiar ou rotacionar esse endereço, acompanhar mensagens e revisar anexos. A rotação invalida o endereço anterior em uma transação; o remetente nunca é tratado como usuário autorizado.

O endpoint `POST /api/webhooks/inbound-email` exige os headers `x-vencii-timestamp` (Unix em segundos) e `x-vencii-signature`. A assinatura é o HMAC-SHA256 hexadecimal de `<timestamp>.<corpo-json>` usando `INBOUND_WEBHOOK_SECRET`, aceita por até cinco minutos. O adapter JSON genérico recebe `id`, `to`, `from`, `subject`, `receivedAt` e `attachments` com `id`, `name`, `contentType` e `contentBase64`. Corpo HTML e conteúdo integral do e-mail são descartados; apenas metadados permitidos são persistidos.

Em desenvolvimento, `INBOUND_EMAIL_PROVIDER=local` usa o mesmo contrato e assinatura, sem provedor externo. Em produção, mantenha `disabled` até configurar um provedor que transforme seu webhook nesse contrato ou use `generic_hmac`. Anexos passam pela mesma validação de assinatura real, limite, hash, deduplicação, bucket privado e tela de revisão do upload manual. Eventos repetidos são neutralizados por `provider_message_id` e chave idempotente, e o limite inicial é de 60 mensagens por organização/hora.

## Relatórios e exportações

A página `/app/relatorios` oferece contas previstas, pagas e vencidas, valores por fornecedor e categoria, diferença entre previsto e realizado, tempo médio de aprovação e histórico de pagamentos e estornos. Período, status, fornecedor, categoria, forma de pagamento e responsável permanecem na URL. Agregações e paginação são executadas pela função SQL `get_management_report`; a tela não carrega toda a base para calcular métricas.

CSV e PDF usam a mesma consulta e os mesmos filtros da interface. O CSV inclui BOM UTF-8, separador por ponto e vírgula e proteção contra fórmulas, facilitando a abertura no Excel em pt-BR. O PDF é um resumo executivo com empresa, período, totais, geração e detalhamento paginado, sem ser apresentado como demonstração contábil.

Exportações com até 2.000 linhas são entregues imediatamente e registradas no `audit_logs`. Acima disso, `report_exports` cria um trabalho assíncrono; `/api/cron/report-exports` processa até cinco arquivos por execução, armazena-os no bucket privado `report-exports`, notifica o solicitante e expira o arquivo após 24 horas. O limite por arquivo é de 5.000 linhas. A rota usa o mesmo `CRON_SECRET` dos lembretes.

## Comandos

```bash
npm run dev             # desenvolvimento
npm run build           # build de produção
npm run typecheck       # TypeScript sem emissão
npm run lint            # ESLint sem warnings
npm run format          # aplica Prettier
npm run format:check    # valida formatação
npm run test            # testes unitários Vitest
npm run test:e2e        # fluxos Playwright
npm run check           # typecheck + lint + unitários + build
npm run supabase:start  # inicia Supabase local (Docker)
npm run supabase:stop   # encerra Supabase local
npm run db:reset        # recria banco e aplica migrations/seeds
npm run db:test         # executa testes pgTAP de RLS
```

Para gerar novamente os tipos TypeScript a partir do schema local:

```bash
npx supabase gen types typescript --local --schema public > src/types/database.ts
```

O arquivo atual já descreve o schema desta entrega. Depois de qualquer migration, execute a geração e revise o diff antes de substituir tipos auxiliares usados pela aplicação.

Na primeira execução E2E:

```bash
npx playwright install chromium
```

## Estrutura

```text
src/
├── app/               # rotas, layouts e Server Actions
├── components/        # interface e primitives shadcn/ui
├── config/            # ambiente validado
├── dal/               # contexto autorizado do workspace
├── domain/            # regras puras, dinheiro e datas de negócio
├── infrastructure/    # clientes Supabase para browser, servidor e proxy
├── repositories/      # acesso tipado a dados, fora da UI
├── services/          # sessão e organização ativa
├── types/             # tipos do schema
└── validation/        # schemas Zod dos formulários
supabase/
├── migrations/        # schema, RLS, triggers e RPCs
├── tests/database/    # testes pgTAP multiempresa
└── seed.sql           # seed explicitamente vazio nesta fundação
tests/e2e/             # fluxos críticos Playwright
```

## Decisões arquiteturais

- Server Components são o padrão; componentes client-side ficam restritos a formulários e controles interativos.
- Componentes visuais não acessam Supabase. O fluxo é UI → Server Action/DAL → repositório → infraestrutura.
- O cookie de organização é apenas contexto de navegação; ele é conferido contra associações retornadas sob RLS e nunca substitui autorização no banco.
- Todas as entidades de negócio incluem `organization_id NOT NULL`, índices adequados e policies baseadas em membro ativo.
- Dinheiro é inteiro em centavos (`MoneyInCents`), nunca float.
- Vencimentos são datas de negócio `AAAA-MM-DD` (`BusinessDate`), sem conversão automática para UTC.
- Não há mocks ou dados falsos em runtime. O seed está vazio e documentado.
- `/health` informa somente o status da aplicação, sem consultar serviços ou expor configuração.

## Configuração manual do Supabase hospedado

1. Vincule o projeto com `npx supabase link --project-ref <ref>` e aplique as migrations com `npx supabase db push`.
2. Em **Authentication → URL Configuration**, informe a URL real da aplicação e permita `https://seu-dominio/auth/confirm` (mantenha localhost apenas para desenvolvimento).
3. Nos templates de confirmação e recuperação, use o endpoint `/auth/confirm` preservando `token_hash`, `type` e o destino esperado.
4. Habilite confirmação de e-mail em produção, defina senha mínima de 8 caracteres com letras e números e configure SMTP próprio.
5. Copie a Project URL e a publishable key para o ambiente de deploy. Não configure service role key no frontend.
6. Confirme em **Storage** que o bucket privado `payable-documents` foi criado pela migration. Não altere o bucket para público.
7. No deploy, configure `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente de servidor. O agendador envia `Authorization: Bearer <CRON_SECRET>` automaticamente.
8. Para e-mails reais, valide o domínio no Resend e configure `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` e `EMAIL_FROM`. Use `EMAIL_PROVIDER=local` em desenvolvimento e testes.
9. Para recebimento, configure o domínio/MX no provedor escolhido, aponte o webhook para `/api/webhooks/inbound-email` e use o mesmo `INBOUND_WEBHOOK_SECRET` no adaptador. Isso é independente do envio de lembretes.
10. Confirme que o deploy executa `/api/cron/report-exports`; o `vercel.json` agenda a fila aos 15 minutos de cada hora. Não torne o bucket `report-exports` público.

Depois de atualizar o projeto hospedado, aplique `npx supabase db push`. No ambiente local, inicie o Docker Desktop e execute `npm run db:reset` seguido de `npm run db:test` para recriar o schema e rodar os testes pgTAP.
