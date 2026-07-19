enum AppDestination: Equatable {
    case discovery
}

struct AppRootState: Equatable {
    private(set) var destination: AppDestination = .discovery
}
