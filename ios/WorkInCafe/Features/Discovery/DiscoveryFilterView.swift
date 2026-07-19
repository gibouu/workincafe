import SwiftUI

enum DiscoveryFilterCopy {
    static func applyTitle(count: Int) -> String {
        "Show \(count) work \(count == 1 ? "spot" : "spots")"
    }
}

private struct DiscoveryFilterCountRequest: Equatable {
    let sourceRevision: UInt
    let query: String
    let filter: DiscoveryFilter
}

struct DiscoveryCategoryOption: Identifiable, Hashable {
    let id: String
    let label: String
    let symbolName: String
    let color: Color
    let foreground: PlacePresentation.Foreground

    init(category: String) {
        let presentation = PlacePresentation.resolve(
            category: category,
            brand: nil,
            name: ""
        )
        id = category
        label = presentation.label
        symbolName = presentation.symbolName
        color = Color(hex: presentation.hexColor)
        foreground = presentation.foreground
    }

    static func activeOptions(for categories: Set<String>) -> [Self] {
        categories.map(Self.init(category:))
            .sorted { $0.label < $1.label }
    }
}

struct DiscoveryFilterView: View {
    let categories: [DiscoveryCategoryOption]
    let sourcePlaces: [PlaceSummary]
    let sourceRevision: UInt
    let query: String
    let onApply: (DiscoveryFilter) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var draft: DiscoveryFilter
    @State private var matchingPlaceCount: Int?

    init(
        filter: DiscoveryFilter,
        categories: [DiscoveryCategoryOption],
        sourcePlaces: [PlaceSummary],
        sourceRevision: UInt,
        query: String,
        onApply: @escaping (DiscoveryFilter) -> Void
    ) {
        self.categories = categories
        self.sourcePlaces = sourcePlaces
        self.sourceRevision = sourceRevision
        self.query = query
        self.onApply = onApply
        _draft = State(initialValue: filter)
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Type of place") {
                    ForEach(categories) { category in
                        filterRow(
                            title: category.label,
                            symbolName: category.symbolName,
                            color: category.color,
                            isSelected: draft.categories.contains(category.id),
                            identifier: "filter.category.\(category.id)"
                        ) {
                            toggleCategory(category.id)
                        }
                    }
                }

                Section {
                    ForEach(DiscoveryFilter.supportedMinimumRatings, id: \.self) { rating in
                        filterRow(
                            title: "\(Int(rating))+",
                            symbolName: "star.fill",
                            color: .orange,
                            isSelected: draft.minimumRating == rating,
                            identifier: "filter.rating.\(Int(rating))"
                        ) {
                            draft.minimumRating = draft.minimumRating == rating ? nil : rating
                        }
                    }
                } header: {
                    Text("Work rating")
                } footer: {
                    Text("Ratings use the 1–10 work-rating scale.")
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("filter.cancel")
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Reset") { draft = DiscoveryFilter() }
                        .disabled(draft.activeCount == 0)
                        .accessibilityIdentifier("filter.reset")
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    onApply(draft)
                } label: {
                    Group {
                        if let matchingPlaceCount {
                            Text(DiscoveryFilterCopy.applyTitle(count: matchingPlaceCount))
                        } else {
                            Label("Updating results…", systemImage: "hourglass")
                        }
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: WICSpacing.minimumControlTarget)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, WICSpacing.medium)
                .padding(.vertical, WICSpacing.small)
                .background(.regularMaterial)
                .accessibilityIdentifier("filter.apply")
            }
        }
        .accessibilityIdentifier("filter.screen")
        .task(
            id: DiscoveryFilterCountRequest(
                sourceRevision: sourceRevision,
                query: query,
                filter: draft
            )
        ) {
            matchingPlaceCount = nil
            let count = await DiscoveryMatchingWorker.shared.count(
                in: sourcePlaces,
                query: query,
                filter: draft
            )
            guard !Task.isCancelled else { return }
            matchingPlaceCount = count
        }
    }

    private func filterRow(
        title: String,
        symbolName: String,
        color: Color,
        isSelected: Bool,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: WICSpacing.compact) {
                Image(systemName: symbolName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(color)
                    .frame(width: 34, height: 34)
                    .background(color.opacity(0.12), in: Circle())

                Text(title)
                    .foregroundStyle(.wicPrimaryText)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.wicAccent)
                }
            }
            .frame(minHeight: WICSpacing.minimumControlTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityIdentifier(identifier)
    }

    private func toggleCategory(_ category: String) {
        if draft.categories.contains(category) {
            draft.categories.remove(category)
        } else {
            draft.categories.insert(category)
        }
    }
}
