import SwiftUI

struct AppRootView: View {
    @StateObject private var model: MapFeatureModel

    init() {
        let api = LivePlacesAPI(baseURL: APIConfiguration.baseURL)
        _model = StateObject(wrappedValue: MapFeatureModel(api: api, cache: PlaceCache()))
    }

    var body: some View {
        NavigationStack {
            MapScreen(model: model)
                .toolbar(.hidden, for: .navigationBar)
        }
        .tint(.wicAccent)
    }
}
