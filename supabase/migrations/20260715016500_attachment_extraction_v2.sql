-- Permite reprocessar anexos extraídos por versões antigas sem remover o arquivo.
create or replace function public.claim_attachment_extraction(
  p_organization_id uuid,
  p_attachment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  if auth.uid() is null or not private.has_organization_role(
    p_organization_id,
    array['owner', 'admin', 'operator']::public.organization_role[],
    auth.uid()
  ) then
    raise exception 'Sem permissão para processar este documento.' using errcode = '42501';
  end if;

  update public.payable_attachments
  set extraction_status = 'processing',
      processing_attempts = processing_attempts + 1,
      last_error = null
  where id = p_attachment_id
    and organization_id = p_organization_id
    and processing_attempts < 3
    and (
      extraction_status in ('uploaded', 'failed')
      or (
        extraction_status = 'needs_review'
        and case
          when extraction_data ->> 'version' ~ '^\d+$'
            then (extraction_data ->> 'version')::integer
          else 0
        end < 2
      )
    );

  claimed := found;
  return claimed;
end;
$$;
