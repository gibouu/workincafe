import MapKit
import SwiftUI

struct MapViewRepresentable: UIViewRepresentable {
    let places: [PlaceSummary]
    let selectedPlaceID: String?
    let cameraIntent: MapCameraIntent?
    let onSelect: (PlaceSummary) -> Void
    let onBoundsChanged: (PlaceBounds) -> Void
    let onQueryabilityChanged: (Bool) -> Void

    init(
        places: [PlaceSummary],
        selectedPlaceID: String?,
        cameraIntent: MapCameraIntent?,
        onSelect: @escaping (PlaceSummary) -> Void,
        onBoundsChanged: @escaping (PlaceBounds) -> Void,
        onQueryabilityChanged: @escaping (Bool) -> Void = { _ in }
    ) {
        self.places = places
        self.selectedPlaceID = selectedPlaceID
        self.cameraIntent = cameraIntent
        self.onSelect = onSelect
        self.onBoundsChanged = onBoundsChanged
        self.onQueryabilityChanged = onQueryabilityChanged
    }

    func makeCoordinator() -> MapCoordinator {
        MapCoordinator(
            onSelect: selectPlace(id:),
            onBoundsChanged: onBoundsChanged,
            onQueryabilityChanged: onQueryabilityChanged
        )
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        let configuration = MKStandardMapConfiguration(elevationStyle: .flat)
        configuration.emphasisStyle = .muted
        configuration.pointOfInterestFilter = .excludingAll
        mapView.preferredConfiguration = configuration
        mapView.delegate = context.coordinator
        mapView.showsCompass = true
        mapView.showsScale = false
        mapView.showsUserLocation = false
        mapView.cameraZoomRange = MKMapView.CameraZoomRange(
            minCenterCoordinateDistance: 220,
            maxCenterCoordinateDistance: 150_000
        )
        mapView.register(
            PlaceAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: PlaceAnnotationView.reuseIdentifier
        )
        mapView.register(
            ClusterAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: ClusterAnnotationView.reuseIdentifier
        )
        mapView.setRegion(
            MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522),
                span: MKCoordinateSpan(latitudeDelta: 0.045, longitudeDelta: 0.06)
            ),
            animated: false
        )
        mapView.accessibilityIdentifier = "map.root"
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.onSelect = selectPlace(id:)
        context.coordinator.onBoundsChanged = onBoundsChanged
        context.coordinator.onQueryabilityChanged = onQueryabilityChanged
        context.coordinator.update(
            places: places,
            selectedPlaceID: selectedPlaceID,
            cameraIntent: cameraIntent,
            on: mapView
        )
    }

    private func selectPlace(id: String) {
        guard let place = places.first(where: { $0.id == id }) else { return }
        onSelect(place)
    }
}

@MainActor
final class MapCoordinator: NSObject, MKMapViewDelegate {
    var onSelect: (String) -> Void
    var onBoundsChanged: (PlaceBounds) -> Void
    var onQueryabilityChanged: (Bool) -> Void

    private let reconciler = AnnotationReconciler()
    private var reconcileTask: Task<Void, Never>?
    private var boundsTask: Task<Void, Never>?
    private var reconcileGeneration = 0
    private var lastPlaces: [PlaceSummary]?
    private var selectedPlaceID: String?
    private var lastCameraIntent: MapCameraIntent?
    private var lastQueryability: Bool?
    private var isSynchronizingSelection = false

    init(
        onSelect: @escaping (String) -> Void,
        onBoundsChanged: @escaping (PlaceBounds) -> Void,
        onQueryabilityChanged: @escaping (Bool) -> Void
    ) {
        self.onSelect = onSelect
        self.onBoundsChanged = onBoundsChanged
        self.onQueryabilityChanged = onQueryabilityChanged
    }

    func update(
        places: [PlaceSummary],
        selectedPlaceID: String?,
        cameraIntent: MapCameraIntent?,
        on mapView: MKMapView
    ) {
        self.selectedPlaceID = selectedPlaceID
        reconcile(places: validUniquePlaces(from: places), on: mapView)
        apply(cameraIntent: cameraIntent, on: mapView)
        synchronizeSelection(on: mapView)
    }

    private func validUniquePlaces(from places: [PlaceSummary]) -> [PlaceSummary] {
        var seenIDs = Set<String>()
        return places.filter { place in
            let id = place.id.trimmingCharacters(in: .whitespacesAndNewlines)
            let coordinate = CLLocationCoordinate2D(
                latitude: place.latitude,
                longitude: place.longitude
            )
            return !id.isEmpty
                && CLLocationCoordinate2DIsValid(coordinate)
                && seenIDs.insert(place.id).inserted
        }
    }

    private func reconcile(places: [PlaceSummary], on mapView: MKMapView) {
        guard places != lastPlaces else { return }
        lastPlaces = places
        reconcileTask?.cancel()
        reconcileGeneration += 1
        let generation = reconcileGeneration
        let snapshots = mapView.annotations.compactMap { annotation -> AnnotationSnapshot? in
            guard let annotation = annotation as? PlaceAnnotation else { return nil }
            return AnnotationSnapshot(payload: annotation.payload)
        }
        reconcileTask = Task { [weak self, weak mapView] in
            guard let self, let mapView else { return }
            let diff = await reconciler.diff(existing: snapshots, incoming: places)
            guard !Task.isCancelled, reconcileGeneration == generation else { return }
            apply(diff, to: mapView)
            synchronizeSelection(on: mapView)
        }
    }

    private func apply(_ diff: AnnotationDiff, to mapView: MKMapView) {
        var annotationsByID: [String: PlaceAnnotation] = [:]
        var duplicateAnnotations: [PlaceAnnotation] = []
        for case let annotation as PlaceAnnotation in mapView.annotations {
            if annotationsByID[annotation.payload.id] == nil {
                annotationsByID[annotation.payload.id] = annotation
            } else {
                duplicateAnnotations.append(annotation)
            }
        }

        let removals = diff.removedIDs.compactMap { annotationsByID[$0] }
        mapView.removeAnnotations(removals + duplicateAnnotations)
        for update in diff.updated {
            guard let annotation = annotationsByID[update.id] else { continue }
            annotation.update(with: update.place)
            (mapView.view(for: annotation) as? PlaceAnnotationView)?.refresh()
        }
        mapView.addAnnotations(diff.added.map(PlaceAnnotation.init))
    }

    private func apply(cameraIntent: MapCameraIntent?, on mapView: MKMapView) {
        guard cameraIntent != lastCameraIntent else { return }
        lastCameraIntent = cameraIntent
        guard case let .focus(_, _, latitude, longitude) = cameraIntent else { return }
        let coordinate = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        guard CLLocationCoordinate2DIsValid(coordinate) else { return }

        let currentSpan = mapView.region.span
        let span = MKCoordinateSpan(
            latitudeDelta: min(currentSpan.latitudeDelta, 0.018),
            longitudeDelta: min(currentSpan.longitudeDelta, 0.018)
        )
        mapView.setRegion(
            MKCoordinateRegion(center: coordinate, span: span),
            animated: !UIAccessibility.isReduceMotionEnabled
        )
    }

    private func synchronizeSelection(on mapView: MKMapView) {
        let placeAnnotations = mapView.annotations.compactMap { $0 as? PlaceAnnotation }
        isSynchronizingSelection = true
        defer { isSynchronizingSelection = false }

        for annotation in placeAnnotations {
            if annotation.payload.id == selectedPlaceID {
                if !mapView.selectedAnnotations.contains(where: { $0 === annotation }) {
                    mapView.selectAnnotation(annotation, animated: !UIAccessibility.isReduceMotionEnabled)
                }
            } else if mapView.selectedAnnotations.contains(where: { $0 === annotation }) {
                mapView.deselectAnnotation(annotation, animated: !UIAccessibility.isReduceMotionEnabled)
            }
        }
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: any MKAnnotation) -> MKAnnotationView? {
        if annotation is MKClusterAnnotation {
            mapView.dequeueReusableAnnotationView(
                withIdentifier: ClusterAnnotationView.reuseIdentifier,
                for: annotation
            )
        } else if annotation is PlaceAnnotation {
            mapView.dequeueReusableAnnotationView(
                withIdentifier: PlaceAnnotationView.reuseIdentifier,
                for: annotation
            )
        } else {
            nil
        }
    }

    func mapView(_ mapView: MKMapView, didSelect annotation: any MKAnnotation) {
        if let cluster = annotation as? MKClusterAnnotation {
            mapView.showAnnotations(
                cluster.memberAnnotations,
                animated: !UIAccessibility.isReduceMotionEnabled
            )
            mapView.deselectAnnotation(cluster, animated: false)
        } else if let placeAnnotation = annotation as? PlaceAnnotation,
                  !isSynchronizingSelection {
            onSelect(placeAnnotation.payload.id)
        }
    }

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        boundsTask?.cancel()
        let region = mapView.region
        let bounds = PlaceBounds(
            west: region.center.longitude - region.span.longitudeDelta / 2,
            south: region.center.latitude - region.span.latitudeDelta / 2,
            east: region.center.longitude + region.span.longitudeDelta / 2,
            north: region.center.latitude + region.span.latitudeDelta / 2
        )

        guard bounds.isQueryable else {
            boundsTask = Task { [weak self] in
                await Task.yield()
                guard !Task.isCancelled else { return }
                self?.publishQueryability(false)
            }
            return
        }
        boundsTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .milliseconds(250))
            } catch {
                return
            }
            guard !Task.isCancelled, let self else { return }
            publishQueryability(true)
            onBoundsChanged(bounds)
        }
    }

    private func publishQueryability(_ isQueryable: Bool) {
        guard lastQueryability != isQueryable else { return }
        lastQueryability = isQueryable
        onQueryabilityChanged(isQueryable)
    }
}
