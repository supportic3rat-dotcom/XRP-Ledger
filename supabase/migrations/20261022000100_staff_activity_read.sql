-- Staff can review customers' devices and security activity (sign-ins, location, account changes) from the admin console.
drop policy own_devices on public.devices;
create policy own_devices on public.devices for select to authenticated using (customer_id = auth.uid() or public.is_staff());
drop policy own_security_events on public.security_events;
create policy own_security_events on public.security_events for select to authenticated using (customer_id = auth.uid() or public.is_staff());
