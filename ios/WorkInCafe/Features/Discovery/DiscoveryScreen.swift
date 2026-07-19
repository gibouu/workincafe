import SwiftUI

struct DiscoveryScreen: View {
    @ObservedObject var model: MapFeatureModel
    @ObservedObject var store: DiscoveryStore
    @ObservedObject var router: AppRouter

    @State private var isMapQueryable = true
    @State private var unavailableAction: UnavailableAction?

    var body: some View {
        ZStack(alignment: .top) {
            discoveryContent
            discoveryHeader
            mapStatus
        }
        .overlay(alignment: .bottomTrailing) {
            if store.mode == .map {
                mapActions
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("app.discovery.root")
        .task { model.start() }
        .task(id: model.places) {
            synchronizePlaces(model.places)
        }
        .sheet(isPresented: previewPresented, onDismiss: clearSelection) {
            if let selectedPlace {
                PlaceSheet(place: selectedPlace)
            }
        }
        .alert(item: $unavailableAction) { action in
            Alert(
                title: Text(action.title),
                message: Text(action.message),
                dismissButton: .default(Text("OK"))
            )
        }
    }

    @ViewBuilder
    private var discoveryContent: some View {
        switch store.mode {
        case .map:
            MapViewRepresentable(
                places: store.filteredPlaces,
                selectedPlaceID: store.selectedPlaceID,
                cameraIntent: store.cameraIntent,
                onSelect: selectPlace,
                onBoundsChanged: model.viewportChanged,
                onQueryabilityChanged: { isMapQueryable = $0 }
            )
            .ignoresSafeArea()
        case .list:
            DiscoveryListView(
                places: store.filteredPlaces,
                selectedPlaceID: store.selectedPlaceID,
                isLoading: model.isLoading,
                errorMessage: model.errorMessage,
                hasActiveCriteria: !store.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    || store.filter.activeCount > 0,
                onSelect: selectPlace,
                onRetry: model.retry
            )
        }
    }

    private var discoveryHeader: some View {
        VStack(spacing: WICSpacing.small) {
            HStack(spacing: WICSpacing.compact) {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.wicSecondaryText)

                TextField("Name, neighborhood, or address", text: $store.query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .accessibilityLabel("Search work spots")
                    .accessibilityIdentifier("discovery.search")

                Divider()
                    .frame(height: 24)

                filterMenu
            }
            .padding(.horizontal, WICSpacing.compact)
            .frame(minHeight: 50)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: WICRadius.field, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: WICRadius.field, style: .continuous)
                    .stroke(.wicSurfaceBorder, lineWidth: 0.5)
            }

            DiscoveryModePicker(selection: $store.mode)
        }
        .padding(.horizontal, WICSpacing.medium)
        .padding(.top, WICSpacing.small)
    }

    private var filterMenu: some View {
        Menu {
            ForEach(categoryOptions, id: \.key) { option in
                Button {
                    toggleCategory(option.key)
                } label: {
                    Label(
                        option.label,
                        systemImage: store.filter.categories.contains(option.key)
                            ? "checkmark.circle.fill"
                            : option.symbolName
                    )
                }
            }

            if store.filter.activeCount > 0 {
                Divider()
                Button("Clear filters", systemImage: "xmark.circle") {
                    store.filter = DiscoveryFilter()
                }
            }
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "line.3.horizontal.decrease")
                    .font(.body.weight(.semibold))
                    .frame(
                        width: WICSpacing.minimumControlTarget,
                        height: WICSpacing.minimumControlTarget
                    )

                if store.filter.activeCount > 0 {
                    Text("\(store.filter.activeCount)")
                        .font(.caption2.bold())
                        .foregroundStyle(.white)
                        .frame(minWidth: 16, minHeight: 16)
                        .background(.wicAccent, in: Circle())
                        .accessibilityHidden(true)
                }
            }
        }
        .accessibilityLabel("Filters")
        .accessibilityValue(
            store.filter.activeCount == 0
                ? "No active filters"
                : "\(store.filter.activeCount) active"
        )
    }

    @ViewBuilder
    private var mapStatus: some View {
        if store.mode == .map {
            VStack {
                Spacer().frame(height: 120)

                if !isMapQueryable {
                    statusPill(
                        title: "Zoom in to search this area",
                        symbol: "plus.magnifyingglass"
                    )
                } else if model.isLoading, model.places.isEmpty {
                    HStack(spacing: WICSpacing.small) {
                        ProgressView()
                        Text("Loading work spots…")
                    }
                    .font(.footnote.weight(.medium))
                    .padding(.horizontal, WICSpacing.medium)
                    .frame(minHeight: WICSpacing.minimumControlTarget)
                    .background(.regularMaterial, in: Capsule())
                } else if let errorMessage = model.errorMessage {
                    errorPill(errorMessage)
                } else if store.filteredPlaces.isEmpty {
                    statusPill(
                        title: store.query.isEmpty
                            ? "No work spots in this area"
                            : "No matching work spots",
                        symbol: "mappin.slash"
                    )
                }

                Spacer()
            }
            .padding(.horizontal, WICSpacing.medium)
            .allowsHitTesting(model.errorMessage != nil)
        }
    }

    private func statusPill(title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.footnote.weight(.medium))
            .padding(.horizontal, WICSpacing.medium)
            .frame(minHeight: WICSpacing.minimumControlTarget)
            .background(.regularMaterial, in: Capsule())
    }

    private func errorPill(_ message: String) -> some View {
        HStack(spacing: WICSpacing.small) {
            Image(systemName: "wifi.exclamationmark")
            VStack(alignment: .leading, spacing: 2) {
                if !model.places.isEmpty {
                    Text("Showing saved results")
                        .font(.footnote.weight(.semibold))
                }
                Text(message)
                    .font(.caption)
                    .lineLimit(1)
            }
            Button("Retry") { model.retry() }
                .font(.footnote.weight(.semibold))
                .frame(minHeight: WICSpacing.minimumControlTarget)
        }
        .padding(.leading, WICSpacing.compact)
        .padding(.trailing, WICSpacing.small)
        .background(.regularMaterial, in: Capsule())
    }

    private var mapActions: some View {
        VStack(alignment: .trailing, spacing: WICSpacing.small) {
            Button {
                unavailableAction = .location
            } label: {
                Image(systemName: "location")
                    .font(.body.weight(.semibold))
                    .frame(
                        width: WICSpacing.minimumControlTarget,
                        height: WICSpacing.minimumControlTarget
                    )
                    .background(.regularMaterial, in: Circle())
                    .overlay {
                        Circle().stroke(.wicSurfaceBorder, lineWidth: 0.5)
                    }
            }
            .accessibilityLabel("Current location unavailable")
            .accessibilityHint("Location services are not connected in this build")

            Button {
                unavailableAction = .addPlace
            } label: {
                Label("Add place", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, WICSpacing.compact)
                    .frame(minHeight: WICSpacing.minimumControlTarget)
                    .background(.regularMaterial, in: Capsule())
                    .overlay {
                        Capsule().stroke(.wicSurfaceBorder, lineWidth: 0.5)
                    }
            }
            .accessibilityHint("Add place is not connected in this build")
        }
        .padding(.trailing, WICSpacing.medium)
        .padding(.bottom, 88)
    }

    private var categoryOptions: [CategoryOption] {
        var seen = Set<String>()
        return store.sourcePlaces.compactMap { place in
            guard seen.insert(place.category).inserted else { return nil }
            return CategoryOption(
                key: place.category,
                label: place.categoryLabel,
                symbolName: place.symbolName
            )
        }
        .sorted { $0.label < $1.label }
    }

    private var selectedPlace: PlaceSummary? {
        guard let selectedPlaceID = store.selectedPlaceID else { return nil }
        return store.sourcePlaces.first { $0.id == selectedPlaceID }
    }

    private var previewPresented: Binding<Bool> {
        Binding(
            get: {
                if case .placePreview = router.sheet { true } else { false }
            },
            set: { isPresented in
                if !isPresented {
                    router.sheet = nil
                }
            }
        )
    }

    private func toggleCategory(_ category: String) {
        if store.filter.categories.contains(category) {
            store.filter.categories.remove(category)
        } else {
            store.filter.categories.insert(category)
        }
    }

    private func synchronizePlaces(_ places: [PlaceSummary]) {
        store.sourcePlaces = places
        if let selectedPlaceID = store.selectedPlaceID,
           !places.contains(where: { $0.id == selectedPlaceID }) {
            store.selectedPlaceID = nil
            router.sheet = nil
        }
    }

    private func selectPlace(_ place: PlaceSummary) {
        store.select(place: place)
        store.mode = .map
        router.sheet = .placePreview(id: place.id)
    }

    private func clearSelection() {
        router.sheet = nil
        store.selectedPlaceID = nil
    }
}

private struct DiscoveryModePicker: View {
    @Binding var selection: DiscoveryMode

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 9, style: .continuous)
                .fill(Color(uiColor: .tertiarySystemFill))
                .frame(height: 32)

            HStack(spacing: 2) {
                ForEach(DiscoveryMode.allCases, id: \.self) { mode in
                    Button {
                        selection = mode
                    } label: {
                        Text(mode.rawValue)
                            .font(.footnote.weight(selection == mode ? .semibold : .regular))
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .contentShape(Rectangle())
                            .background {
                                if selection == mode {
                                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                                        .fill(Color(uiColor: .systemBackground))
                                        .frame(height: 28)
                                        .shadow(color: .black.opacity(0.12), radius: 1, y: 1)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(mode.rawValue)
                    .accessibilityValue(selection == mode ? "Selected" : "Not selected")
                    .accessibilityAddTraits(selection == mode ? .isSelected : [])
                    .accessibilityIdentifier("discovery.mode.\(mode.rawValue.lowercased())")
                }
            }
        }
        .frame(width: 144, height: WICSpacing.minimumControlTarget)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Discovery view")
        .accessibilityIdentifier("discovery.mode")
    }
}

private struct CategoryOption {
    let key: String
    let label: String
    let symbolName: String
}

private enum UnavailableAction: String, Identifiable {
    case location
    case addPlace

    var id: String { rawValue }

    var title: String {
        switch self {
        case .location: "Location unavailable"
        case .addPlace: "Add place unavailable"
        }
    }

    var message: String {
        switch self {
        case .location:
            "Current-location permission and services are not connected in this build."
        case .addPlace:
            "The native Add place flow is not connected in this build."
        }
    }
}
