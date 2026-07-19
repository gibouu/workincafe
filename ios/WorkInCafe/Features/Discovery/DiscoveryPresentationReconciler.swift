struct DiscoveryPresentationState: Equatable {
    let selectedPlaceID: String?
    let sheet: AppSheet?
}

enum DiscoveryPresentationReconciler {
    static func reconcile(
        selectedPlaceID: String?,
        sheet: AppSheet?,
        availablePlaceIDs: Set<String>
    ) -> DiscoveryPresentationState {
        guard let selectedPlaceID,
              !availablePlaceIDs.contains(selectedPlaceID) else {
            return DiscoveryPresentationState(
                selectedPlaceID: selectedPlaceID,
                sheet: sheet
            )
        }

        let reconciledSheet: AppSheet?
        if sheet == .placePreview(id: selectedPlaceID) {
            reconciledSheet = nil
        } else {
            reconciledSheet = sheet
        }

        return DiscoveryPresentationState(
            selectedPlaceID: nil,
            sheet: reconciledSheet
        )
    }
}
