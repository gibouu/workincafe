enum MapCameraIntent: Equatable, Sendable {
    case focus(
        requestID: UInt,
        placeID: String,
        latitude: Double,
        longitude: Double
    )
}
