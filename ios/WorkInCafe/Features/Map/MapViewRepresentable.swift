import MapKit
import SwiftUI

struct MapViewRepresentable: UIViewRepresentable {
    let places: [PlaceSummary]
    let onSelect: (PlaceSummary) -> Void
    let onBoundsChanged: (PlaceBounds) -> Void

    func makeCoordinator() -> MapCoordinator {
        MapCoordinator(onSelect: onSelect, onBoundsChanged: onBoundsChanged)
    }

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.delegate = context.coordinator
        mapView.pointOfInterestFilter = .excludingAll
        mapView.showsCompass = true
        mapView.register(PlaceAnnotationView.self, forAnnotationViewWithReuseIdentifier: PlaceAnnotationView.reuseIdentifier)
        mapView.register(ClusterAnnotationView.self, forAnnotationViewWithReuseIdentifier: ClusterAnnotationView.reuseIdentifier)
        mapView.setRegion(
            MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 48.8566, longitude: 2.3522),
                span: MKCoordinateSpan(latitudeDelta: 0.087, longitudeDelta: 0.245)
            ),
            animated: false
        )
        mapView.accessibilityIdentifier = "map.root"
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.onSelect = onSelect
        context.coordinator.onBoundsChanged = onBoundsChanged
        context.coordinator.reconcile(places: places, on: mapView)
    }
}

@MainActor
final class MapCoordinator: NSObject, MKMapViewDelegate {
    var onSelect: (PlaceSummary) -> Void
    var onBoundsChanged: (PlaceBounds) -> Void
    private let reconciler = AnnotationReconciler()
    private var reconcileTask: Task<Void, Never>?

    init(
        onSelect: @escaping (PlaceSummary) -> Void,
        onBoundsChanged: @escaping (PlaceBounds) -> Void
    ) {
        self.onSelect = onSelect
        self.onBoundsChanged = onBoundsChanged
    }

    func reconcile(places: [PlaceSummary], on mapView: MKMapView) {
        reconcileTask?.cancel()
        let snapshots = mapView.annotations.compactMap { annotation -> AnnotationSnapshot? in
            guard let annotation = annotation as? PlaceAnnotation else { return nil }
            return AnnotationSnapshot(
                id: annotation.id,
                latitude: annotation.coordinate.latitude,
                longitude: annotation.coordinate.longitude,
                presentationKey: annotation.place.presentationKey
            )
        }
        reconcileTask = Task { [weak self, weak mapView] in
            guard let self, let mapView else { return }
            let diff = await reconciler.diff(existing: snapshots, incoming: places)
            guard !Task.isCancelled else { return }
            apply(diff, to: mapView)
        }
    }

    private func apply(_ diff: AnnotationDiff, to mapView: MKMapView) {
        let annotationsByID = Dictionary(
            uniqueKeysWithValues: mapView.annotations.compactMap { annotation -> (String, PlaceAnnotation)? in
                guard let annotation = annotation as? PlaceAnnotation else { return nil }
                return (annotation.id, annotation)
            }
        )
        let removals = diff.removedIDs.compactMap { annotationsByID[$0] }
        mapView.removeAnnotations(removals)
        for update in diff.updated {
            annotationsByID[update.id]?.update(with: update.place)
        }
        mapView.addAnnotations(diff.added.map(PlaceAnnotation.init))
    }

    func mapView(_ mapView: MKMapView, viewFor annotation: any MKAnnotation) -> MKAnnotationView? {
        if annotation is MKClusterAnnotation {
            return mapView.dequeueReusableAnnotationView(
                withIdentifier: ClusterAnnotationView.reuseIdentifier,
                for: annotation
            )
        }
        guard annotation is PlaceAnnotation else { return nil }
        return mapView.dequeueReusableAnnotationView(
            withIdentifier: PlaceAnnotationView.reuseIdentifier,
            for: annotation
        )
    }

    func mapView(_ mapView: MKMapView, didSelect annotation: any MKAnnotation) {
        if let cluster = annotation as? MKClusterAnnotation {
            mapView.showAnnotations(cluster.memberAnnotations, animated: true)
        } else if let placeAnnotation = annotation as? PlaceAnnotation {
            onSelect(placeAnnotation.place)
            mapView.deselectAnnotation(annotation, animated: false)
        }
    }

    func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
        let region = mapView.region
        let bounds = PlaceBounds(
            west: region.center.longitude - region.span.longitudeDelta / 2,
            south: region.center.latitude - region.span.latitudeDelta / 2,
            east: region.center.longitude + region.span.longitudeDelta / 2,
            north: region.center.latitude + region.span.latitudeDelta / 2
        )
        Task { @MainActor [weak self] in
            await Task.yield()
            self?.onBoundsChanged(bounds)
        }
    }
}
