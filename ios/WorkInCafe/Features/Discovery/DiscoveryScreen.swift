import SwiftUI

struct DiscoveryScreen: View {
    @ObservedObject var model: MapFeatureModel
    @ObservedObject var store: DiscoveryStore
    @ObservedObject var router: AppRouter

    @State private var isMapQueryable = true
    @State private var unavailableAction: UnavailableAction?
    @State private var pendingPreviewID: String?

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
        .fullScreenCover(isPresented: searchPresented, onDismiss: presentPendingPreview) {
            DiscoverySearchView(
                store: store,
                categories: categoryOptions,
                onSelect: selectPlaceFromSearch
            )
        }
        .sheet(isPresented: filtersPresented) {
            DiscoveryFilterView(
                filter: store.filter,
                categories: categoryOptions,
                sourcePlaces: store.sourcePlaces,
                sourceRevision: store.sourceRevision,
                query: store.query,
                onApply: applyFilter
            )
        }
        .sheet(isPresented: previewPresented, onDismiss: clearSelection) {
            if let selectedPlace {
                PlaceSheet(place: selectedPlace)
                    .accessibilityIdentifier("place.preview")
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
                Button {
                    router.sheet = .search
                } label: {
                    HStack(spacing: WICSpacing.compact) {
                        Image(systemName: "magnifyingglass")
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.wicSecondaryText)

                        Text(searchLabel)
                            .font(.body)
                            .foregroundStyle(
                                store.query.isEmpty ? .wicSecondaryText : .wicPrimaryText
                            )
                            .lineLimit(1)

                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search work spots")
                .accessibilityValue(
                    store.query.isEmpty ? "No search term" : store.query
                )
                .accessibilityIdentifier("discovery.search")

                Divider()
                    .frame(height: 24)

                filterButton
            }
            .padding(.horizontal, WICSpacing.compact)
            .frame(minHeight: 50)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: WICRadius.field, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: WICRadius.field, style: .continuous)
                    .stroke(.wicSurfaceBorder, lineWidth: 0.5)
            }

            if store.filter.activeCount > 0 {
                activeFilterChips
            }

            DiscoveryModePicker(selection: $store.mode)
        }
        .padding(.horizontal, WICSpacing.medium)
        .padding(.top, WICSpacing.small)
    }

    private var filterButton: some View {
        Button {
            router.sheet = .filters
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
        .accessibilityIdentifier("discovery.filters")
    }

    private var activeFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: WICSpacing.small) {
                ForEach(
                    DiscoveryCategoryOption.activeOptions(for: store.filter.categories)
                ) { option in
                    activeFilterButton(
                        title: option.label,
                        identifier: "filter.active.\(option.id)"
                    ) {
                        store.filter.categories.remove(option.id)
                    }
                }

                if let minimumRating = store.filter.minimumRating {
                    activeFilterButton(
                        title: "\(Int(minimumRating))+ rating",
                        identifier: "filter.active.rating.\(Int(minimumRating))"
                    ) {
                        store.filter.minimumRating = nil
                    }
                }
            }
            .padding(.horizontal, 1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func activeFilterButton(
        title: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title)
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
            }
            .font(.footnote.weight(.semibold))
            .padding(.horizontal, WICSpacing.compact)
            .frame(minHeight: WICSpacing.minimumControlTarget)
            .foregroundStyle(.wicAccent)
            .background(.wicAccentTint, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Remove \(title) filter")
        .accessibilityIdentifier(identifier)
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

    private var searchLabel: String {
        store.query.isEmpty ? "Name, neighborhood, or address" : store.query
    }

    private var categoryOptions: [DiscoveryCategoryOption] {
        var seen = Set<String>()
        return store.sourcePlaces.compactMap { place in
            guard seen.insert(place.category).inserted else { return nil }
            return DiscoveryCategoryOption(category: place.category)
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

    private var searchPresented: Binding<Bool> {
        sheetBinding(for: .search)
    }

    private var filtersPresented: Binding<Bool> {
        sheetBinding(for: .filters)
    }

    private func sheetBinding(for sheet: AppSheet) -> Binding<Bool> {
        Binding(
            get: { router.sheet == sheet },
            set: { isPresented in
                if !isPresented, router.sheet == sheet {
                    router.sheet = nil
                }
            }
        )
    }

    private func synchronizePlaces(_ places: [PlaceSummary]) {
        store.sourcePlaces = places
        let presentation = DiscoveryPresentationReconciler.reconcile(
            selectedPlaceID: store.selectedPlaceID,
            sheet: router.sheet,
            availablePlaceIDs: Set(places.map(\.id))
        )
        if store.selectedPlaceID != presentation.selectedPlaceID {
            store.selectedPlaceID = presentation.selectedPlaceID
        }
        if router.sheet != presentation.sheet {
            router.sheet = presentation.sheet
        }
    }

    private func selectPlace(_ place: PlaceSummary) {
        store.select(place: place)
        store.mode = .map
        router.sheet = .placePreview(id: place.id)
    }

    private func selectPlaceFromSearch(_ place: PlaceSummary) {
        store.select(place: place)
        store.mode = .map
        pendingPreviewID = place.id
        router.sheet = nil
    }

    private func presentPendingPreview() {
        guard let pendingPreviewID,
              store.selectedPlaceID == pendingPreviewID else { return }
        self.pendingPreviewID = nil
        router.sheet = .placePreview(id: pendingPreviewID)
    }

    private func applyFilter(_ filter: DiscoveryFilter) {
        store.filter = filter
        router.sheet = nil
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
