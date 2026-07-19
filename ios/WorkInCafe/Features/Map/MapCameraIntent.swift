enum MapCameraIntent: Equatable, Sendable {
    case focus(placeID: String, latitude: Double, longitude: Double)
}
