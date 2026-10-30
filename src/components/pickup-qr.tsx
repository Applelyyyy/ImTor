import QRCode from 'qrcode';
import { createPickupQr } from '@/lib/pickup-qr';
import { PickupQrButton } from './pickup-qr-button';
export async function PickupQr({ id, code }: { id: string; code: string }) {
  const svg = await QRCode.toString(createPickupQr(id, code), { type: 'svg', margin: 4, width: 280, errorCorrectionLevel: 'M', color: { dark: '#23352b', light: '#ffffff' } });
  return <PickupQrButton image={`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`} code={code} />;
}
