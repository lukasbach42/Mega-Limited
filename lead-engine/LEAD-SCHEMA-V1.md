# Lead schema v1

The lead destination must store these fields before launch:

- lead_id
- created_at
- name
- phone
- postcode
- current_insurer
- requested_date
- requested_time
- consent
- consent_version
- landing_url
- utm_source
- utm_medium
- utm_campaign
- utm_content
- utm_term
- status
- contacted_at
- qualified
- quoted
- sold
- annual_premium
- acquisition_cost
- notes

## Required events

Landing page:
- mega_lead_view

Successful submission:
- mega_lead_submitted

Down-funnel (server/CRM when available):
- mega_lead_contacted
- mega_lead_qualified
- mega_quote_created
- mega_policy_sold

## Meta mapping

Use mega_lead_submitted as the source for Meta Lead conversion once Pixel/CAPI is connected. Do not fire it on button click; only after the lead endpoint confirms persistence.

## Privacy/compliance

Persist the exact consent_version and timestamp with each lead. Keep insurer/partner identity out of acquisition UTM/campaign naming so the acquisition asset remains portable.
