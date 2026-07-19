@preconcurrency import MapKit
import UIKit

@MainActor
final class PlaceAnnotation: NSObject, @preconcurrency MKAnnotation {
    let id: String
    dynamic var coordinate: CLLocationCoordinate2D
    var place: PlaceSummary

    init(place: PlaceSummary) {
        id = place.id
        coordinate = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
        self.place = place
        super.init()
    }

    func update(with place: PlaceSummary) {
        self.place = place
        coordinate = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
    }
}

@MainActor
final class PlaceAnnotationView: MKMarkerAnnotationView {
    static let reuseIdentifier = "workincafe.place"

    override var annotation: (any MKAnnotation)? {
        didSet { configure() }
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        clusteringIdentifier = nil
        accessibilityLabel = nil
        accessibilityHint = nil
    }

    private func configure() {
        guard let annotation = annotation as? PlaceAnnotation else { return }
        clusteringIdentifier = Self.reuseIdentifier
        displayPriority = .defaultHigh
        markerTintColor = annotation.place.category == "cafe" ? .systemBrown : .systemBlue
        glyphImage = UIImage(systemName: annotation.place.symbolName)
        canShowCallout = false
        isAccessibilityElement = true
        accessibilityTraits = .button
        let rating = annotation.place.rating.map { ", rated \(String(format: "%.1f", $0))" } ?? ""
        accessibilityLabel = "\(annotation.place.name), \(annotation.place.categoryLabel)\(rating)"
        accessibilityHint = "Shows details"
    }
}

@MainActor
final class ClusterAnnotationView: MKMarkerAnnotationView {
    static let reuseIdentifier = "workincafe.cluster"

    override var annotation: (any MKAnnotation)? {
        didSet {
            guard let cluster = annotation as? MKClusterAnnotation else { return }
            markerTintColor = .systemBlue
            glyphText = "\(cluster.memberAnnotations.count)"
            displayPriority = .required
            isAccessibilityElement = true
            accessibilityTraits = .button
            accessibilityLabel = "\(cluster.memberAnnotations.count) work spots"
            accessibilityHint = "Zooms in"
        }
    }
}
