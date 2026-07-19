import CoreLocation
import MapKit
import SwiftUI

struct PlaceSheet: View {
    let place: PlaceSummary
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: WICSpacing.large) {
                    HStack(spacing: WICSpacing.medium) {
                        Image(systemName: place.symbolName)
                            .font(.title2)
                            .foregroundStyle(.white)
                            .frame(width: 52, height: 52)
                            .background(.wicCafe, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                        VStack(alignment: .leading, spacing: 4) {
                            Text(place.categoryLabel).font(.subheadline).foregroundStyle(.secondary)
                            if let rating = place.rating, rating > 0 {
                                Label(String(format: "%.1f work rating", rating), systemImage: "star.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.orange)
                            }
                        }
                    }

                    if !place.address.isEmpty {
                        Label(place.address, systemImage: "mappin.and.ellipse")
                            .font(.body)
                    }
                    if let membership = place.membershipRequired, !membership.isEmpty {
                        Label(membership, systemImage: "person.badge.key.fill")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    Button {
                        AppleMapsDirections.open(place: place)
                    } label: {
                        Label("Walking directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                            .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .accessibilityHint("Opens this destination in Apple Maps")
                }
                .padding(WICSpacing.large)
            }
            .navigationTitle(place.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                        .labelStyle(.iconOnly)
                        .accessibilityIdentifier("place.close")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("place.sheet")
    }
}

enum AppleMapsDirections {
    @MainActor
    static func open(place: PlaceSummary) {
        let coordinate = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        item.name = place.name
        item.openInMaps(launchOptions: [
            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking,
        ])
    }
}
