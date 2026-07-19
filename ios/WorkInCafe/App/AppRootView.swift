import SwiftUI

struct AppRootView: View {
    let destination: AppDestination
    @StateObject private var model: MapFeatureModel

    init(destination: AppDestination = .discovery) {
        self.destination = destination
        let api = LivePlacesAPI(baseURL: APIConfiguration.baseURL)
        _model = StateObject(wrappedValue: MapFeatureModel(api: api, cache: PlaceCache()))
    }

    var body: some View {
        NavigationStack {
            switch destination {
            case .discovery:
                MapScreen(model: model)
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .tint(.wicAccent)
    }
}
