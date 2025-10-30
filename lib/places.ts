import { Loader } from '@googlemaps/js-api-loader';
import { getPublicGoogleMapsKey } from './config';

let loader: Loader | null = null;
let librariesImported = false;

export async function ensureMaps(): Promise<typeof google> {
  if (!loader) {
    loader = new Loader({
      apiKey: getPublicGoogleMapsKey(),
      version: 'weekly',
      libraries: []
    });
  }
  const g = await loader.load();
  if (!librariesImported) {
    await Promise.all([
      // @ts-ignore importLibrary available at runtime
      (g.maps as any).importLibrary('maps'),
      (g.maps as any).importLibrary('places'),
      (g.maps as any).importLibrary('marker'),
    ]);
    librariesImported = true;
  }
  return g;
}

export function placesHealthCheck(): boolean {
  return typeof customElements !== 'undefined' && !!customElements.get('gmp-place-autocomplete');
}


