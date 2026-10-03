# Bike Shop Invoices

An iPhone app (React + Vite, wrapped with Capacitor) for Neighborhood Bike Repair. It covers the shop's
paper repair order: customer and 2nd authorized contact, bikes and serial #, received/promised times,
service performed, parts (qty, part no., condition N/U/R/RC, warranty), labor (flat/hourly), other
charges, tax, estimate choice, retain/destroy parts, guarantee and authorization.

**Send** texts the invoice to the customer's phone through Messages, with the total, the shop's Zelle
contact and a payment link (set on the **Shop** tab; `{amount}` and `{invoice}` in the link are filled in).
Mark it paid by Zelle, link, cash or card when the money arrives. Everything is stored on the phone.

```sh
npm install
npm run dev      # browser version; open the Network URL on a phone on the same Wi-Fi
npm run build    # type-check + production build into dist/
npm test         # vitest: totals, message text, storage, and UI flows
npm run ios      # rebuild, sync into ios/, open Xcode (Run onto the connected iPhone)
```
