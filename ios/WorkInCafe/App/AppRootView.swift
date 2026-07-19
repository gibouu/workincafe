import SwiftUI

struct AppRootView: View {
    private let environment: AppEnvironment
    @StateObject private var router: AppRouter
    @StateObject private var model: MapFeatureModel
    @StateObject private var discoveryStore: DiscoveryStore

    init(environment: AppEnvironment = .current()) {
        self.environment = environment
        _router = StateObject(wrappedValue: AppRouter())
        _discoveryStore = StateObject(wrappedValue: DiscoveryStore())
        _model = StateObject(
            wrappedValue: MapFeatureModel(
                api: environment.placesAPI,
                cache: environment.placeCache
            )
        )
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            modeContent

            if activePath.isEmpty {
                RootProductDock(selection: $router.mode)
                    .padding(.horizontal, WICSpacing.medium)
                    .padding(.bottom, WICSpacing.small)
            }
        }
        .tint(.wicAccent)
    }

    @ViewBuilder
    private var modeContent: some View {
        switch router.mode {
        case .profile:
            NavigationStack(path: $router.profilePath) {
                unavailableMode(
                    title: "Profile",
                    symbol: "person.crop.circle",
                    description: "Sign-in, saved places, and contributions are not available yet."
                )
                .navigationDestination(for: AppRoute.self, destination: destination)
            }
        case .workSpots:
            NavigationStack(path: $router.workSpotsPath) {
                DiscoveryScreen(
                    model: model,
                    store: discoveryStore,
                    router: router
                )
                    .toolbar(.hidden, for: .navigationBar)
                    .navigationDestination(for: AppRoute.self, destination: destination)
            }
        case .cowork:
            NavigationStack(path: $router.coworkPath) {
                unavailableMode(
                    title: "Cowork",
                    symbol: "person.2",
                    description: "Coworker matching is not available yet."
                )
                .navigationDestination(for: AppRoute.self, destination: destination)
            }
        }
    }

    private var activePath: [AppRoute] {
        switch router.mode {
        case .profile:
            router.profilePath
        case .workSpots:
            router.workSpotsPath
        case .cowork:
            router.coworkPath
        }
    }

    private func unavailableMode(
        title: String,
        symbol: String,
        description: String
    ) -> some View {
        ContentUnavailableView(
            title,
            systemImage: symbol,
            description: Text(description)
        )
    }

    @ViewBuilder
    private func destination(for route: AppRoute) -> some View {
        switch route {
        case let .placeDetail(id):
            if let place = model.places.first(where: { $0.id == id }) {
                PlaceDetailView(place: place)
            } else {
                ContentUnavailableView(
                    "Work spot unavailable",
                    systemImage: "mappin.slash",
                    description: Text("This work spot is no longer in the current results.")
                )
            }
        }
    }
}
