# QR pickup and stable overlays

Operate mode. Preserve paper #fff9f0, surface #fffdf8, ink #23352b, leaf #267a4a and rule #e2e6da. Kodchasan carries controls. Category labels use symmetric padding and no spinner. Existing ports, OAuth, storage, database schema and Tunnel remain unchanged.

```
Customer: booking card -> show QR -> status updates after merchant scan
Merchant: scan QR -> rear camera / local QR image -> existing pickup transaction -> receipt
```

QR encodes a versioned, bounded ImTor payload containing reservation ID and the existing pickup proof. It is generated locally; no third-party QR service or secret-bearing URL is used. Only the authenticated customer receives their proof. Merchant scanning initiates an origin-checked POST, never a state-changing GET. Store ownership, optional scanner store binding, pickup time, expiry and constant-time proof comparison remain server-side. Repeated valid scans return the same completion without adding stock/sales effects. Invalid QR, wrong store/account, expired/cancelled orders and revoked permissions remain errors.

Customer status uses a small ownership-scoped status-only request every2seconds while a pending page is visible. Requests do not overlap and stop when hidden, unmounted or all orders are terminal. No pickup codes are included in status replies. This avoids adding deployment infrastructure for a classroom-sized demo.

Camera decoding is lazy-loaded. No camera frames or selected QR photographs are uploaded. Camera tracks stop when closing, hiding, completing or failing a scan. A local QR-image option supports devices with no camera. Browser permission and HTTPS are required for camera use.

Read-only layout evidence found injected react-remove-scroll-bar CSS overwrote body header padding during all modal overlays. Preserve the shell padding in one scoped rule instead of adding portal hacks or disabling modal behavior. Installed dropdown/dialog/sheet/select portals already escape normal flow.

Reference implementations: [node-qrcode](https://github.com/soldair/node-qrcode), [jsQR](https://github.com/cozmo/jsQR), [Radix dropdowns](https://www.radix-ui.com/primitives/docs/components/dropdown-menu).
