# Bike Shop Invoices

An iPhone app (React + Vite, wrapped with Capacitor) for Neighborhood Bike Repair. It covers the shop's
paper repair order: customer and 2nd authorized contact, bikes and serial #, received/promised times,
service performed, parts (qty, part no., condition N/U/R/RC, warranty), labor (flat/hourly), other
charges, tax, estimate choice, retain/destroy parts, guarantee and authorization.

**Send** texts the invoice to the customer's phone through Messages, with the total, the shop's Zelle
contact and a payment link (set on the **Settings** tab; `{amount}` and `{invoice}` in the link are filled in).

**Face ID protection is optional and off by default**, including when upgrading from the old PIN.
Enable **Require Face ID for Income** on the **Settings** tab in the installed iPhone app. Turning it
on or off requires a fresh Face ID match; there is no app PIN or device-passcode fallback. When enabled,
Income and the owner income-tax rate lock when you leave their tab or background the app. Set up Face ID
in iPhone Settings first and allow Bike Invoices to use it. On lockout, unlock the iPhone itself with its
passcode before trying Face ID again. Browsers and devices without Face ID cannot enable protection;
if it was already enabled, they keep Income locked. With protection off, Income opens directly.
**Settings** also contains shop/payment details, custom pick lists, and invoice backup export/import.
This is a screen privacy lock, not storage encryption: orders and exported backups contain financial data.
Mark it paid by Zelle, link, cash or card when the money arrives. Everything is stored on the phone.

**Income → Export & share** creates tax-year CSV and PDF sales reports. Select the calendar year,
then share to an available iPhone app (Mail, Messages, Files, etc.); browsers download when file sharing
is unavailable. Reports include annual/monthly totals and paid-invoice detail in USD, counted by local
payment date, using payment snapshots when available. Customer names, contact details and repair notes
are omitted. Sales tax is separate from net sales. These are cash-basis sales summaries for CPA review,
not tax returns or direct TurboTax imports: expenses, deductions and unrecorded refunds are not tracked.
Export is blocked when stored invoices are unreadable, to avoid reporting incomplete totals.

```sh
npm install
npm run dev      # browser version; open the Network URL on a phone on the same Wi-Fi
npm run build    # type-check + production build into dist/
npm test         # vitest: totals, message text, storage, and UI flows
npm run ios      # rebuild, sync into ios/, open Xcode (Run onto the connected iPhone)
```
