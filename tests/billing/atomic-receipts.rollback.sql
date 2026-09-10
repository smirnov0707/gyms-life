-- Run only in the staging project through an authorized database session.
-- Synthetic account/subscription identifiers only. No Paddle API call. Always ROLLBACK.
begin;
select set_config('gyms.billing_user',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('gyms.billing_user')::uuid,current_setting('gyms.billing_user')||'@example.invalid');
set local role service_role;
do $$
declare
 p jsonb; q jsonb; r text; rejected boolean; n integer;
 sid text:='sub_'||substr(replace(gen_random_uuid()::text,'-',''),1,26);
 ev text:='evt_'||substr(replace(gen_random_uuid()::text,'-',''),1,26);
 cancel_event text:='evt_'||substr(replace(gen_random_uuid()::text,'-',''),1,26);
 claim text:='evt_'||substr(replace(gen_random_uuid()::text,'-',''),1,26);
 bad_event text:='evt_'||substr(replace(gen_random_uuid()::text,'-',''),1,26);
begin
 p:=jsonb_build_object('id',sid,'customer_id','ctm_'||repeat('1',26),'user_id',current_setting('gyms.billing_user'),
   'price_id','pri_'||repeat('1',26),'product_id','pro_'||repeat('1',26),'status','active',
   'current_period_start','2026-09-01T00:00:00Z','current_period_end','2026-10-01T00:00:00Z','cancel_at_period_end',false);
 r:=public.apply_verified_paddle_subscription(ev,'subscription.updated','sandbox','2026-09-09T08:00:00Z',p);
 if r<>'applied' then raise exception 'Updated-first snapshot failed';end if;
 r:=public.apply_verified_paddle_subscription(ev,'subscription.updated','sandbox','2026-09-09T08:00:00Z',p);
 if r<>'duplicate' then raise exception 'Duplicate failed';end if;
 q:=p||'{"status":"canceled","current_period_start":null,"current_period_end":null}'::jsonb;
 r:=public.apply_verified_paddle_subscription(cancel_event,'subscription.canceled','sandbox','2026-09-09T09:00:00Z',q);
 if r<>'applied' then raise exception 'Cancellation failed';end if;
 r:=public.apply_verified_paddle_subscription('evt_'||substr(replace(gen_random_uuid()::text,'-',''),1,26),'subscription.created','sandbox','2026-09-09T07:00:00Z',p);
 if r<>'stale' or (select status from public.subscriptions where paddle_subscription_id=sid)<>'canceled' then raise exception 'Old event resurrected cancelled subscription';end if;
 insert into public.paddle_webhook_events(event_id,event_type,environment) values(claim,'subscription.updated','sandbox');
 q:=p||jsonb_build_object('user_id',null,'price_id','pri_'||repeat('2',26),'cancel_at_period_end',true);
 r:=public.apply_verified_paddle_subscription(claim,'subscription.updated','sandbox','2026-09-09T10:00:00Z',q);
 if r<>'applied' then raise exception 'Legacy unfinished claim blocked real persistence';end if;
 if (select user_id from public.subscriptions where paddle_subscription_id=sid)<>current_setting('gyms.billing_user')::uuid
   or not (select cancel_at_period_end from public.subscriptions where paddle_subscription_id=sid)
   or (select price_id from public.subscriptions where paddle_subscription_id=sid)<>'pri_'||repeat('2',26)
 then raise exception 'Updated snapshot incomplete';end if;
 rejected:=false;
 begin perform public.apply_verified_paddle_subscription(bad_event,'subscription.updated','live','2026-09-09T11:00:00Z',p);
 exception when raise_exception then rejected:=SQLERRM='PADDLE_ENVIRONMENT_CONFLICT';end;
 if not rejected then raise exception 'Environment was rebound';end if;
 rejected:=false;
 begin perform public.apply_verified_paddle_subscription(bad_event,'subscription.updated','sandbox','2026-09-09T11:00:00Z',p||jsonb_build_object('user_id',gen_random_uuid()));
 exception when raise_exception then rejected:=SQLERRM='PADDLE_OWNERSHIP_CONFLICT';end;
 if not rejected then raise exception 'Owner was rebound';end if;
 rejected:=false;
 begin perform public.apply_verified_paddle_subscription(bad_event,'subscription.created','sandbox','2026-09-09T11:00:00Z',p||jsonb_build_object('id','sub_'||substr(replace(gen_random_uuid()::text,'-',''),1,26),'user_id',gen_random_uuid()));
 exception when foreign_key_violation then rejected:=true;end;
 if not rejected then raise exception 'Expected failed persistence';end if;
 if exists(select 1 from public.paddle_subscription_receipts where event_id=bad_event) then raise exception 'Failed persistence left a receipt';end if;
 r:=public.apply_verified_paddle_subscription(bad_event,'subscription.updated','sandbox','2026-09-09T11:00:00Z',p);
 if r<>'applied' then raise exception 'Retry after failure could not commit';end if;
 rejected:=false;
 begin perform public.apply_verified_paddle_subscription(ev,'subscription.created','sandbox','2026-09-09T08:00:00Z',p);
 exception when raise_exception then rejected:=SQLERRM='PADDLE_EVENT_ID_COLLISION';end;
 if not rejected then raise exception 'Collision was treated as a valid receipt';end if;
 if has_function_privilege('authenticated','public.apply_verified_paddle_subscription(text,text,text,timestamptz,jsonb)','execute')
   or has_function_privilege('anon','public.apply_verified_paddle_subscription(text,text,text,timestamptz,jsonb)','execute')
   or has_table_privilege('authenticated','public.paddle_subscription_receipts','select')
 then raise exception 'Client access to internal billing writes/receipts';end if;
 select count(*) into n from public.paddle_subscription_receipts where subscription_id=sid;
 if n<>5 then raise exception 'Unexpected receipt count: %',n;end if;
 perform set_config('gyms.billing_result','passed',true);
end $$;
select jsonb_build_object('scope','staging synthetic subscription snapshots; full rollback; no Paddle charge',
 'status',current_setting('gyms.billing_result')) as billing_transaction_verification;
rollback;
