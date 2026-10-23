create or replace function private.match_approval_rule(
  p_organization_id uuid,
  p_amount_cents bigint,
  p_category_id uuid,
  p_supplier_id uuid
)
returns table (rule_id uuid, required_approvals integer)
language sql
stable
security definer
set search_path = ''
as $$
  select rule.id, rule.required_approvals
  from public.approval_rules rule
  where rule.organization_id = p_organization_id
    and rule.active
    and (rule.min_amount_cents is null or p_amount_cents >= rule.min_amount_cents)
    and (rule.max_amount_cents is null or p_amount_cents <= rule.max_amount_cents)
    and (rule.category_id is null or rule.category_id = p_category_id)
    and (rule.supplier_id is null or rule.supplier_id = p_supplier_id)
  order by (
    (rule.supplier_id is not null)::integer * 8
    + (rule.category_id is not null)::integer * 4
    + (rule.min_amount_cents is not null)::integer
    + (rule.max_amount_cents is not null)::integer
  ) desc,
  rule.priority desc,
  rule.created_at,
  rule.id
  limit 1;
$$;
