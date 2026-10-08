# Bike Shop Invoices

An iPhone app (React + Vite, wrapped with Capacitor) for Neighborhood Bike Repair. It covers the shop's
paper repair order: customer and 2nd authorized contact, bikes and serial #, received/promised times,
service performed, parts (qty, part no., condition N/U/R/RC, warranty), labor (flat/hourly), other
charges, tax, estimate choice, retain/destroy parts, guarantee and authorization.

**Send** texts the invoice to the customer's phone through Messages, with the total, the shop's Zelle
contact and a payment link (set on the **Settings** tab; `{amount}` and `{invoice}` in the link are filled in).

**Income** and the owner income-tax rate require Face ID in the installed iPhone app, with no app PIN
or device-passcode fallback. Leaving the tab or backgrounding the app locks access again. Set up Face ID
in iPhone Settings first and allow Bike Invoices to use it. On lockout, unlock the iPhone itself with its
passcode before trying Face ID again. Browsers and devices without Face ID keep Income locked.
**Settings** also contains shop/payment details, custom pick lists, and invoice backup export/import.
This is a screen privacy lock, not storage encryption: orders and exported backups contain financial data.
Mark it paid by Zelle, link, cash or card when the money arrives. Everything is stored on the phone.

```sh
npm install
npm run dev      # browser version; open the Network URL on a phone on the same Wi-Fi
npm run build    # type-check + production build into dist/
npm test         # vitest: totals, message text, storage, and UI flows
npm run ios      # rebuild, sync into ios/, open Xcode (Run onto the connected iPhone)
```
