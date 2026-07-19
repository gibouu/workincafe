import SwiftUI

struct DiscoveryListView: View {
    let places: [PlaceSummary]
    let selectedPlaceID: String?
    let onSelect: (PlaceSummary) -> Void

    var body: some View {
        Group {
            if places.isEmpty {
                ContentUnavailableView(
                    "No matching work spots",
                    systemImage: "mappin.slash",
                    description: Text("Clear a filter or search another neighborhood.")
                )
            } else {
                List(places) { place in
                    Button {
                        onSelect(place)
                    } label: {
                        PlaceResultRow(
                            place: place,
                            isSelected: selectedPlaceID == place.id
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Shows this work spot on the map")
                    .listRowBackground(
                        selectedPlaceID == place.id
                            ? Color.wicAccentTint
                            : Color(uiColor: .systemBackground)
                    )
                }
                .listStyle(.plain)
                .contentMargins(.top, 112, for: .scrollContent)
                .contentMargins(.bottom, 88, for: .scrollContent)
            }
        }
        .background(.wicSurface)
        .accessibilityIdentifier("discovery.list")
    }
}
