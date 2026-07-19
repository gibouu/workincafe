import SwiftUI

enum DiscoveryListState: Equatable, Sendable {
    case loading
    case failure(message: String)
    case empty(title: String, message: String)
    case results(staleError: String?)

    static func resolve(
        hasPlaces: Bool,
        isLoading: Bool,
        errorMessage: String?,
        hasActiveCriteria: Bool
    ) -> Self {
        if hasPlaces {
            return .results(staleError: errorMessage)
        }

        if isLoading {
            return .loading
        }

        if let errorMessage {
            return .failure(message: errorMessage)
        }

        if hasActiveCriteria {
            return .empty(
                title: "No matching work spots",
                message: "Clear a filter or search another neighborhood."
            )
        }

        return .empty(
            title: "No work spots in this area",
            message: "Move the map to explore another neighborhood."
        )
    }

    var offersRetry: Bool {
        switch self {
        case .failure:
            true
        case let .results(staleError):
            staleError != nil
        case .loading, .empty:
            false
        }
    }
}

struct DiscoveryListView: View {
    let places: [PlaceSummary]
    let selectedPlaceID: String?
    let isLoading: Bool
    let errorMessage: String?
    let hasActiveCriteria: Bool
    let onSelect: (PlaceSummary) -> Void
    let onRetry: () -> Void

    private var state: DiscoveryListState {
        DiscoveryListState.resolve(
            hasPlaces: !places.isEmpty,
            isLoading: isLoading,
            errorMessage: errorMessage,
            hasActiveCriteria: hasActiveCriteria
        )
    }

    var body: some View {
        Group {
            switch state {
            case .loading:
                ProgressView("Loading work spots…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            case let .failure(message):
                ContentUnavailableView {
                    Label("Couldn't load work spots", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(message)
                } actions: {
                    Button("Retry", action: onRetry)
                        .frame(minHeight: WICSpacing.minimumControlTarget)
                }

            case let .empty(title, message):
                ContentUnavailableView(
                    title,
                    systemImage: "mappin.slash",
                    description: Text(message)
                )

            case let .results(staleError):
                List {
                    if let staleError {
                        staleResultsBanner(message: staleError)
                    }

                    ForEach(places) { place in
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
                }
                .listStyle(.plain)
                .contentMargins(.top, 112, for: .scrollContent)
                .contentMargins(.bottom, 88, for: .scrollContent)
            }
        }
        .background(.wicSurface)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("discovery.list")
    }

    private func staleResultsBanner(message: String) -> some View {
        HStack(spacing: WICSpacing.small) {
            Image(systemName: "wifi.exclamationmark")
                .foregroundStyle(.wicAccent)

            VStack(alignment: .leading, spacing: 2) {
                Text("Showing saved results")
                    .font(.subheadline.weight(.semibold))
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: WICSpacing.small)

            Button("Retry", action: onRetry)
                .font(.subheadline.weight(.semibold))
                .frame(minHeight: WICSpacing.minimumControlTarget)
        }
        .padding(.horizontal, WICSpacing.small)
        .background(.wicAccent.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
        .listRowSeparator(.hidden)
        .listRowInsets(
            EdgeInsets(
                top: WICSpacing.small,
                leading: WICSpacing.medium,
                bottom: WICSpacing.small,
                trailing: WICSpacing.medium
            )
        )
        .accessibilityElement(children: .contain)
    }
}
