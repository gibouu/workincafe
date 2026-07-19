import Combine

enum ProductMode: String, CaseIterable, Hashable {
    case profile
    case workSpots
    case cowork
}

enum AppRoute: Hashable {
    case placeDetail(id: String)
}

enum AppSheet: Identifiable, Equatable {
    case search
    case filters
    case placePreview(id: String)

    var id: String {
        switch self {
        case .search:
            "search"
        case .filters:
            "filters"
        case let .placePreview(id):
            "place-preview-\(id)"
        }
    }
}

@MainActor
final class AppRouter: ObservableObject {
    @Published var mode: ProductMode = .workSpots
    @Published var workSpotsPath: [AppRoute] = []
    @Published var profilePath: [AppRoute] = []
    @Published var coworkPath: [AppRoute] = []
    @Published var sheet: AppSheet?
}
