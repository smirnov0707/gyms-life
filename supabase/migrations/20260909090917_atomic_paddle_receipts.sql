-- Receipt and subscription snapshot commit in the same transaction.
-- The legacy claim log is retained untouched; it is not trusted as a completed receipt.
alter table public.subscriptions
  add column if not exists paddle_last_event_at timestamptz,
  add column if not exists paddle_last_event_id text;

create table if not exists public.paddle_subscription_receipts (
  environment text not null check(environment in ('sandbox','live')),
  event_id text not null,
  event_type text not null,
  subscription_id text not null,
  occurred_at timestamptz not null,
  outcome text not null check(outcome in ('applied','stale')),
  processed_at timestamptz not null default now(),
  primary key(environment,event_id)
);
alter table public.paddle_subscription_receipts enable row level security;
revoke all on public.paddle_subscription_receipts from public,anon,authenticated;
grant all on public.paddle_subscription_receipts to service_role;

create or replace function public.apply_verified_paddle_subscription(
 p_event_id text, p_event_type text, p_environment text,
 p_occurred_at timestamptz, p_subscription jsonb
) returns text language plpgsql security invoker set search_path='' as $$
declare
 sid text; uid uuid; customer text; price text; product text; state text;
 starts timestamptz; ends timestamptz; cancelling boolean;
 existing public.subscriptions%rowtype;
 receipt public.paddle_subscription_receipts%rowtype;
 have_existing boolean; outcome text;
begin
 if p_environment is null or p_environment not in ('sandbox','live')
   or p_event_id is null or p_event_id !~ '^evt_[a-z0-9]{26}$'
   or p_event_type is null or p_event_type not in ('subscription.created','subscription.updated','subscription.activated','subscription.trialing','subscription.past_due','subscription.paused','subscription.resumed','subscription.canceled')
   or p_occurred_at is null or not isfinite(p_occurred_at)
   or jsonb_typeof(p_subscription) is distinct from 'object'
 then raise exception 'PADDLE_INVALID_EVENT'; end if;
 sid:=p_subscription->>'id';customer:=p_subscription->>'customer_id';
 price:=p_subscription->>'price_id';product:=p_subscription->>'product_id';state:=p_subscription->>'status';
 if sid is null or sid !~ '^sub_[a-z0-9]{26}$' or customer is null or customer !~ '^ctm_[a-z0-9]{26}$'
   or price is null or price !~ '^pri_[a-z0-9]{26}$' or product is null or product !~ '^pro_[a-z0-9]{26}$'
   or state is null or state not in ('active','trialing','past_due','paused','canceled')
   or jsonb_typeof(p_subscription->'cancel_at_period_end') is distinct from 'boolean'
 then raise exception 'PADDLE_INVALID_SUBSCRIPTION'; end if;
 if p_event_type='subscription.canceled' and state<>'canceled' then raise exception 'PADDLE_INVALID_STATUS';end if;
 uid:=(p_subscription->>'user_id')::uuid;
 starts:=(p_subscription->>'current_period_start')::timestamptz;
 ends:=(p_subscription->>'current_period_end')::timestamptz;
 if (starts is not null and not isfinite(starts)) or (ends is not null and not isfinite(ends))
   or (starts is null)<>(ends is null) or ends<starts then raise exception 'PADDLE_INVALID_PERIOD';end if;
 cancelling:=(p_subscription->>'cancel_at_period_end')::boolean;

 -- Serializes competing snapshots, including simultaneous first arrivals.
 -- Include both environments in the lock domain to prevent cross-environment ID rebinding.
 perform pg_advisory_xact_lock(hashtextextended('gyms:paddle:'||sid,0));
 select * into receipt from public.paddle_subscription_receipts
   where environment=p_environment and event_id=p_event_id;
 if found then
   if receipt.subscription_id<>sid or receipt.event_type<>p_event_type or receipt.occurred_at<>p_occurred_at
     then raise exception 'PADDLE_EVENT_ID_COLLISION'; end if;
   return 'duplicate';
 end if;
 select * into existing from public.subscriptions where paddle_subscription_id=sid for update;
 have_existing:=found;
 if have_existing then
   if existing.environment<>p_environment then raise exception 'PADDLE_ENVIRONMENT_CONFLICT';end if;
   if (uid is not null and uid<>existing.user_id) or customer<>existing.paddle_customer_id
     then raise exception 'PADDLE_OWNERSHIP_CONFLICT';end if;
   uid:=existing.user_id;
 elsif uid is null then raise exception 'PADDLE_MISSING_USER';end if;

 if have_existing and existing.paddle_last_event_at is not null and p_occurred_at<=existing.paddle_last_event_at then
   outcome:='stale';
 else
   insert into public.subscriptions as target
     (user_id,paddle_subscription_id,paddle_customer_id,product_id,price_id,status,
      current_period_start,current_period_end,cancel_at_period_end,environment,
      paddle_last_event_at,paddle_last_event_id,updated_at)
   values(uid,sid,customer,product,price,state,starts,ends,cancelling,p_environment,p_occurred_at,p_event_id,now())
   on conflict(paddle_subscription_id) do update set
     product_id=excluded.product_id,price_id=excluded.price_id,status=excluded.status,
     current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
     cancel_at_period_end=excluded.cancel_at_period_end,paddle_last_event_at=excluded.paddle_last_event_at,
     paddle_last_event_id=excluded.paddle_last_event_id,updated_at=excluded.updated_at;
   outcome:='applied';
 end if;
 -- This row can never outlive a rolled-back subscription write.
 insert into public.paddle_subscription_receipts(environment,event_id,event_type,subscription_id,occurred_at,outcome)
 values(p_environment,p_event_id,p_event_type,sid,p_occurred_at,outcome);
 return outcome;
end $$;
revoke all on function public.apply_verified_paddle_subscription(text,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.apply_verified_paddle_subscription(text,text,text,timestamptz,jsonb) to service_role;
