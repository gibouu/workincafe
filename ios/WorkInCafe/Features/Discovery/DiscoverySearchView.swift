import SwiftUI

enum DiscoverySearchCopy {
    static let emptyDescription =
        "Clear filters, move the map, or try another search term."
}

struct DiscoverySearchView: View {
    @ObservedObject var store: DiscoveryStore
    let categories: [DiscoveryCategoryOption]
    let onSelect: (PlaceSummary) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if store.filteredPlaces.isEmpty {
                    ContentUnavailableView(
                        "No matching work spots",
                        systemImage: "magnifyingglass",
                        description: Text(DiscoverySearchCopy.emptyDescription)
                    )
                    .accessibilityIdentifier("search.empty")
                } else {
                    List(store.filteredPlaces) { place in
                        Button {
                            onSelect(place)
                        } label: {
                            PlaceResultRow(
                                place: place,
                                isSelected: store.selectedPlaceID == place.id
                            )
                        }
                        .buttonStyle(.plain)
                        .frame(minHeight: WICSpacing.minimumControlTarget)
                        .accessibilityHint("Shows this work spot on the current map")
                        .accessibilityIdentifier("search.result.\(place.id)")
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Find a work spot")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $store.query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: "Name, neighborhood, or address"
            )
            .safeAreaInset(edge: .top, spacing: 0) {
                categoryChips
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier("search.done")
                }
            }
        }
        .accessibilityIdentifier("search.screen")
    }

    private var categoryChips: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Searches work spots loaded for the current map area.")
                .font(.caption)
                .foregroundStyle(.wicSecondaryText)
                .padding(.horizontal, WICSpacing.medium)
                .padding(.top, WICSpacing.small)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: WICSpacing.small) {
                    ForEach(categories) { category in
                        let isSelected = store.filter.categories.contains(category.id)
                        Button {
                            if isSelected {
                                store.filter.categories.remove(category.id)
                            } else {
                                store.filter.categories.insert(category.id)
                            }
                        } label: {
                            Label(
                                category.label,
                                systemImage: isSelected ? "checkmark" : category.symbolName
                            )
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(
                                    isSelected
                                        ? category.foreground == .light ? Color.white : Color.black
                                        : category.color
                                )
                                .padding(.horizontal, WICSpacing.compact)
                                .frame(minHeight: WICSpacing.minimumControlTarget)
                                .background(
                                    isSelected ? category.color : category.color.opacity(0.12),
                                    in: Capsule()
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityValue(
                            isSelected ? "Selected, checkmark visible" : "Not selected"
                        )
                        .accessibilityAddTraits(isSelected ? .isSelected : [])
                        .accessibilityIdentifier("search.category.\(category.id)")
                    }
                }
                .padding(.horizontal, WICSpacing.medium)
                .padding(.vertical, WICSpacing.small)
            }
        }
        .background(.regularMaterial)
        .overlay(alignment: .bottom) {
            Divider()
        }
    }
}
