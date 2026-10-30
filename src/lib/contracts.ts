export type PriceView = {
  current: number;
  original: number;
  discountPercent: number;
  active: boolean;
  upcoming: { at: string; price: number } | null;
};
export type ProductView = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  mode: string;
  reservable: boolean;
  stock: number | null;
  allergens: string | null;
  storage: string | null;
  pickupStart: string | null;
  pickupEnd: string | null;
  demo: boolean;
  demoInteractive: boolean;
  sessionId: string | null;
  price: PriceView;
  store: { id: string; slug: string; name: string; verified: boolean };
  category: { id: string; name: string };
  location: string;
  open: boolean;
  marketSlug: string | null;
  stallCode: string | null;
};
export type MarketView = {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string;
  address: string;
  entrance: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  layoutImage: string | null;
  demo: boolean;
  sessions: SessionView[];
  stalls: StallView[];
};
export type SessionView = {
  id: string;
  date: string;
  startsAt: string;
  endsAt: string;
  status: string;
  vendorCount: number;
  confirmedCount: number;
  marketId: string;
};
export type StallView = {
  id: string;
  code: string;
  x: number;
  y: number;
  active: boolean;
  directions: string;
  zone: string;
  vendor: {
    slug: string;
    name: string;
    status: string;
    verified: boolean;
    demo: boolean;
    productNames: string[];
    products: { id: string; name: string; imageUrl: string; price: PriceView }[];
  } | null;
};

/** Only the admin control panel receives this private, persisted demo state. */
export type RealisticDemoConfig = {
  seed: string;
  idempotencyKey: string;
  visitorReservations: boolean;
  useImages: boolean;
  markets: number;
  zones: number;
  stalls: number;
  stores: number;
  products: number;
  customers: number;
  reservations: number;
  historyDays: number;
  futureDays: number;
};
export type RealisticDemoState = {
  batchId: string;
  config: RealisticDemoConfig;
  asOf: string;
  stage: "MEDIA" | "DATA" | "VALIDATE" | "READY" | "ERROR" | "CLEANING" | "REMOVED";
  message: string;
  assets: Record<string, { key: string; url: string; sha256: string; bytes: number }>;
  error?: string;
};
