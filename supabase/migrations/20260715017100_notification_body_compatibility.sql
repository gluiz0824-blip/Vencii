-- Mantém compatibilidade com funções de módulos anteriores que ainda informam
-- `message`, enquanto a API nova expõe o campo canônico `body`.
alter table public.notifications rename column body to message;
alter table public.notifications add column body text;
update public.notifications set body = message;
alter table public.notifications alter column body set not null;
alter table public.notifications
  add constraint notifications_body_length check (char_length(body) between 2 and 500);

create or replace function private.sync_notification_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.body is null then new.body := new.message; end if;
  if new.message is null then new.message := new.body; end if;
  if new.body is distinct from new.message then
    new.message := new.body;
  end if;
  return new;
end;
$$;

create trigger notifications_00_sync_content
before insert or update on public.notifications
for each row execute function private.sync_notification_content();

grant select, insert, update, delete on public.notifications to service_role;
grant select, insert, update, delete on public.reminder_rules to service_role;
grant select, insert, update, delete on public.notification_preferences to service_role;
grant select, insert, update, delete on public.reminder_deliveries to service_role;
