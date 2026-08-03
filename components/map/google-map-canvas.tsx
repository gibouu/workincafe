'use client'

import { useEffect, useRef, useState } from 'react'
import { GoogleMapController, type MapPin } from '@/lib/integrations/google/client/map-controller'

// Declarative Maps canvas (Decision 15): props in, events out. All provider
// handles live inside the adapter's controller; this component only drives it
// from effects and renders the container plus load states.

export type MapCafePin = MapPin

export interface MapsConfig {
  apiKey: string
  mapId: string
}

export function GoogleMapCanvas({
  config,
  cafes,
  selectedCafeId,
  onCafeSelect,
}: {
  config: MapsConfig
  cafes: MapCafePin[]
  selectedCafeId: string | null
  onCafeSelect: (cafeId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<GoogleMapController | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const controller = new GoogleMapController()
    controllerRef.current = controller
    controller.init(container, { apiKey: config.apiKey, mapId: config.mapId }).then(
      () => setStatus('ready'),
      () => setStatus('failed'),
    )
    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [config.apiKey, config.mapId])

  useEffect(() => {
    if (status === 'ready') controllerRef.current?.setOnSelect(onCafeSelect)
  }, [status, onCafeSelect])

  useEffect(() => {
    if (status === 'ready') controllerRef.current?.syncPins(cafes)
  }, [status, cafes])

  useEffect(() => {
    if (status === 'ready') controllerRef.current?.setSelection(selectedCafeId)
  }, [status, selectedCafeId, cafes])

  if (status === 'failed') {
    return <p className="empty-state">The map failed to load — the café list below still works.</p>
  }
  return (
    <div
      ref={containerRef}
      className="map-canvas"
      role="region"
      aria-label="Map of published cafés"
    />
  )
}
