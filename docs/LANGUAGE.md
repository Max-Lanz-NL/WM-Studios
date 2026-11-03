# English interface

Studio MW uses English throughout the storefront, checkout, staff workspace, information pages, accessible labels, validation messages and page metadata. HTML declares lang=en. EUR prices and dates use en-GB formatting; releases still use the Europe/Amsterdam time zone.

Known Dutch copy in the original demo catalog is translated at display time by englishCopy. Custom editorial text is preserved. Database business errors are mapped to English at the application boundary; UNAUTHORIZED and FORBIDDEN remain intact for permission handling. Unknown database messages use a neutral English response. No migrations, permissions, product identifiers or live-payment settings were changed.

Verified on 2 November 2026: typecheck and build pass, 42 unit/SQL/configuration tests pass, and 11 local browser tests pass. Browser coverage includes shopping, a demo checkout, staff login/order processing, product editing, mobile controls, English form labels/information pages and failed-login responses. The local browser suite uses the existing PostgreSQL-backed Auth/Data API test fixture. The true local Supabase suite's selectors were updated, but that separate suite was not rerun for this copy change.
