import SwiftUI

struct SearchSheet: View {
    @ObservedObject var model: MapFeatureModel
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
            Group {
                if model.searchResults.isEmpty, !query.isEmpty {
                    ContentUnavailableView.search(text: query)
                } else {
                    List(model.searchResults) { place in
                        Button {
                            model.selectedPlace = place
                            dismiss()
                        } label: {
                            HStack(spacing: WICSpacing.medium) {
                                Image(systemName: place.symbolName)
                                    .foregroundStyle(.wicAccent)
                                    .frame(width: 32)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(place.name).font(.headline).foregroundStyle(.primary)
                                    Text([place.categoryLabel, place.address].filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                            .frame(minHeight: WICSpacing.minimumControlTarget)
                        }
                        .accessibilityHint("Shows this work spot on the map")
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Find a work spot")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Name, address, or category")
            .onChange(of: query) { _, value in model.search(value) }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .onAppear { model.search(query) }
    }
}
