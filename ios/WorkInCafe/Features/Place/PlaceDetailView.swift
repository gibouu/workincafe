import CoreLocation
import MapKit
import SwiftUI

struct PlaceDetailView: View {
    let place: PlaceSummary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: WICSpacing.large) {
                identity
                location
                supportedStatus
                partialDataNotice
            }
            .padding(.horizontal, WICSpacing.comfortable)
            .padding(.top, WICSpacing.medium)
            .padding(.bottom, WICSpacing.large)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle(place.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .safeAreaInset(edge: .bottom) {
            actionBar
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("place.detail")
    }

    private var identity: some View {
        HStack(alignment: .center, spacing: WICSpacing.medium) {
            PlaceIdentityBadge(place: place, size: 72)

            VStack(alignment: .leading, spacing: 5) {
                Text(place.categoryLabel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.wicSecondaryText)

                Text(place.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.wicPrimaryText)

                WorkRatingView(rating: place.rating, labelStyle: .full)
                    .accessibilityIdentifier("place.detail.rating")
            }
        }
    }

    @ViewBuilder
    private var location: some View {
        if !place.neighborhood.isEmpty || !place.address.isEmpty {
            detailSurface(title: "Location", symbol: "mappin.and.ellipse") {
                VStack(alignment: .leading, spacing: 4) {
                    if !place.neighborhood.isEmpty {
                        Text(place.neighborhood)
                            .font(.body.weight(.semibold))
                    }
                    if !place.address.isEmpty {
                        Text(place.address)
                            .font(.subheadline)
                            .foregroundStyle(.wicSecondaryText)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var supportedStatus: some View {
        if place.isValidated || nonemptyMembership != nil {
            detailSurface(title: "Work spot status", symbol: "checkmark.seal") {
                VStack(alignment: .leading, spacing: WICSpacing.compact) {
                    if place.isValidated {
                        Label("Validated work spot", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.wicPositive)
                    }
                    if let membership = nonemptyMembership {
                        Label(membership, systemImage: "person.badge.key.fill")
                            .foregroundStyle(.wicSecondaryText)
                    }
                }
                .font(.subheadline.weight(.semibold))
            }
        }
    }

    private var partialDataNotice: some View {
        detailSurface(title: "Map summary", symbol: "ellipsis.circle") {
            Text(
                "Reviews, work vitals, live conditions, menus, and business information "
                    + "will appear when full place details are available."
            )
            .font(.subheadline)
            .foregroundStyle(.wicSecondaryText)
            .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityIdentifier("place.detail.partial-data")
    }

    private var actionBar: some View {
        HStack(spacing: WICSpacing.small) {
            Button {
                AppleMapsDirections.open(place: place)
            } label: {
                Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityHint("Opens this destination in Apple Maps")
            .accessibilityIdentifier("place.detail.directions")

            ShareLink(item: shareURL) {
                Label("Share", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
            }
            .buttonStyle(.bordered)
            .accessibilityIdentifier("place.detail.share")
        }
        .controlSize(.large)
        .padding(.horizontal, WICSpacing.medium)
        .padding(.vertical, WICSpacing.small)
        .background(.regularMaterial)
        .overlay(alignment: .top) {
            Divider()
        }
    }

    private func detailSurface<Content: View>(
        title: String,
        symbol: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: WICSpacing.compact) {
            Label(title, systemImage: symbol)
                .font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(WICSpacing.medium)
        .background(.wicSurface, in: RoundedRectangle(cornerRadius: WICRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: WICRadius.card, style: .continuous)
                .stroke(.wicSurfaceBorder, lineWidth: 0.5)
        }
    }

    private var nonemptyMembership: String? {
        guard let membership = place.membershipRequired?
            .trimmingCharacters(in: .whitespacesAndNewlines),
              !membership.isEmpty else { return nil }
        return membership
    }

    private var shareURL: URL {
        URL(string: "https://www.workin.cafe")!
            .appending(path: "place")
            .appending(path: place.id)
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
