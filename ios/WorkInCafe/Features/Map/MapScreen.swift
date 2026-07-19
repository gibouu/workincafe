import SwiftUI

struct MapScreen: View {
    @ObservedObject var model: MapFeatureModel
    @State private var searchPresented = false

    var body: some View {
        ZStack {
            MapViewRepresentable(
                places: model.places,
                onSelect: { model.selectedPlace = $0 },
                onBoundsChanged: model.viewportChanged
            )
            .ignoresSafeArea()

            VStack(spacing: WICSpacing.small) {
                HStack(spacing: WICSpacing.small) {
                    Label("Work in Cafe", systemImage: "cup.and.saucer.fill")
                        .font(.headline)
                        .padding(.horizontal, WICSpacing.medium)
                        .frame(minHeight: WICSpacing.minimumControlTarget)
                        .background(.regularMaterial, in: Capsule())

                    Spacer()

                    Button { searchPresented = true } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.headline)
                            .frame(width: WICSpacing.minimumControlTarget, height: WICSpacing.minimumControlTarget)
                            .background(.regularMaterial, in: Circle())
                    }
                    .accessibilityLabel("Search work spots")
                }

                if let errorMessage = model.errorMessage {
                    HStack(spacing: WICSpacing.small) {
                        Image(systemName: "wifi.exclamationmark")
                        Text(errorMessage).font(.footnote).lineLimit(2)
                        Spacer(minLength: 4)
                        Button("Retry") { model.retry() }.font(.footnote.weight(.semibold))
                    }
                    .padding(.horizontal, WICSpacing.medium)
                    .frame(minHeight: WICSpacing.minimumControlTarget)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }

                Spacer()

                if model.isLoading, model.places.isEmpty {
                    ProgressView("Loading work spots…")
                        .padding(WICSpacing.medium)
                        .background(.regularMaterial, in: Capsule())
                } else if model.places.isEmpty, model.errorMessage == nil {
                    VStack(spacing: WICSpacing.small) {
                        Image(systemName: "mappin.slash")
                        Text("No work spots in this area").font(.headline)
                        Text("Move the map to explore another neighborhood.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .multilineTextAlignment(.center)
                    .padding(WICSpacing.large)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
            }
            .padding(.horizontal, WICSpacing.medium)
            .padding(.top, WICSpacing.small)
            .padding(.bottom, WICSpacing.medium)
        }
        .accessibilityIdentifier("app.discovery.root")
        .task { model.start() }
        .sheet(isPresented: $searchPresented) {
            SearchSheet(model: model)
        }
        .sheet(item: $model.selectedPlace) { place in
            PlaceSheet(place: place)
        }
    }
}
