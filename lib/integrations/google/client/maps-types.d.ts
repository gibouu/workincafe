// Minimal ambient declarations for the narrow Maps JavaScript surface the
// client adapter uses (24c-G4: approved-no-package — official bootstrap, no
// loader and no @types/google.maps dependency). Extend only alongside real
// adapter usage; never declare API surface nothing consumes.

declare namespace google.maps {
  interface LatLngLiteral {
    lat: number
    lng: number
  }

  interface LatLngBoundsLiteral {
    south: number
    west: number
    north: number
    east: number
  }

  class LatLngBounds {
    constructor()
    extend(point: LatLngLiteral): LatLngBounds
    toJSON(): LatLngBoundsLiteral
  }

  interface MapsEventListener {
    remove(): void
  }

  interface MapOptions {
    mapId?: string
    center?: LatLngLiteral
    zoom?: number
    clickableIcons?: boolean
    mapTypeControl?: boolean
    streetViewControl?: boolean
    fullscreenControl?: boolean
  }

  class Map {
    constructor(container: HTMLElement, opts?: MapOptions)
    fitBounds(bounds: LatLngBounds, padding?: number): void
    panTo(latLng: LatLngLiteral): void
    getBounds(): LatLngBounds | undefined
    addListener(eventName: string, handler: () => void): MapsEventListener
  }

  function importLibrary(name: 'maps'): Promise<{ Map: typeof Map }>
  function importLibrary(name: 'marker'): Promise<{
    AdvancedMarkerElement: typeof marker.AdvancedMarkerElement
    PinElement: typeof marker.PinElement
  }>
  function importLibrary(name: string): Promise<unknown>

  namespace marker {
    interface AdvancedMarkerElementOptions {
      map?: Map | null
      position?: LatLngLiteral
      title?: string
      content?: Element | null
      zIndex?: number
    }

    class AdvancedMarkerElement {
      constructor(opts?: AdvancedMarkerElementOptions)
      map: Map | null
      zIndex?: number
      content?: Element | null
      addListener(eventName: string, handler: () => void): MapsEventListener
    }

    interface PinElementOptions {
      scale?: number
      background?: string
      borderColor?: string
      glyphColor?: string
    }

    class PinElement {
      constructor(opts?: PinElementOptions)
      element: HTMLElement
    }
  }
}
