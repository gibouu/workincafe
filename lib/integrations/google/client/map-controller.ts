import { bootstrapGoogleMaps, importMapsLibrary, importMarkerLibrary } from './maps-loader'

// Imperative Maps controller (Decision 15 imperative boundary): the map
// instance, marker handles, and other provider mutables live only inside this
// adapter class — components hold a controller reference and drive it from
// effects with plain method calls; no map handle ever escapes. The map owns
// live camera state; the controller stores nothing React should render from.

export interface MapPin {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface MapControllerConfig {
  apiKey: string
  mapId: string
}

const TORONTO_CENTER = { lat: 43.6532, lng: -79.3832 }
const INITIAL_ZOOM = 12
const FIT_PADDING_PX = 48
const SELECTED_PIN_SCALE = 1.4

export class GoogleMapController {
  private map: google.maps.Map | null = null
  private AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement | null = null
  private PinElement: typeof google.maps.marker.PinElement | null = null
  private markers = new Map<string, google.maps.marker.AdvancedMarkerElement>()
  private pins: MapPin[] = []
  private fitted = false
  private destroyed = false
  private onSelect: (cafeId: string) => void = () => {}

  /** Bootstrap + load libraries + create the map inside `container`. */
  async init(container: HTMLElement, config: MapControllerConfig): Promise<void> {
    bootstrapGoogleMaps(config.apiKey)
    const [mapsLib, markerLib] = await Promise.all([importMapsLibrary(), importMarkerLibrary()])
    if (this.destroyed) return
    this.AdvancedMarkerElement = markerLib.AdvancedMarkerElement
    this.PinElement = markerLib.PinElement
    this.map = new mapsLib.Map(container, {
      mapId: config.mapId,
      center: TORONTO_CENTER,
      zoom: INITIAL_ZOOM,
      // Curated map: Google's own POI popups stay off; our markers are the
      // only interactive places.
      clickableIcons: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
  }

  setOnSelect(handler: (cafeId: string) => void): void {
    this.onSelect = handler
  }

  /** Reconcile markers with the given pins (add new, remove stale); fit the
   * viewport to the pins once, on first non-empty sync. */
  syncPins(pins: MapPin[]): void {
    const map = this.map
    const AdvancedMarkerElement = this.AdvancedMarkerElement
    if (!map || !AdvancedMarkerElement) return
    this.pins = pins
    const seen = new Set<string>()
    for (const pin of pins) {
      seen.add(pin.id)
      if (this.markers.has(pin.id)) continue
      const markerEl = new AdvancedMarkerElement({
        map,
        position: { lat: pin.latitude, lng: pin.longitude },
        title: pin.name,
      })
      markerEl.addListener('click', () => this.onSelect(pin.id))
      this.markers.set(pin.id, markerEl)
    }
    for (const [id, markerEl] of this.markers) {
      if (!seen.has(id)) {
        markerEl.map = null
        this.markers.delete(id)
      }
    }
    if (!this.fitted && pins.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      for (const pin of pins) bounds.extend({ lat: pin.latitude, lng: pin.longitude })
      map.fitBounds(bounds, FIT_PADDING_PX)
      this.fitted = true
    }
  }

  /** Emphasize the selected pin and pan to it. */
  setSelection(selectedId: string | null): void {
    const map = this.map
    const PinElement = this.PinElement
    if (!map || !PinElement) return
    for (const [id, markerEl] of this.markers) {
      const selected = id === selectedId
      const pin = new PinElement(selected ? { scale: SELECTED_PIN_SCALE } : {})
      markerEl.content = pin.element
      markerEl.zIndex = selected ? 10 : 1
    }
    if (selectedId !== null) {
      const pin = this.pins.find((p) => p.id === selectedId)
      if (pin) map.panTo({ lat: pin.latitude, lng: pin.longitude })
    }
  }

  destroy(): void {
    this.destroyed = true
    for (const markerEl of this.markers.values()) markerEl.map = null
    this.markers.clear()
    this.map = null
  }
}
