import Testing
@testable import WorkInCafe

@Suite("Discovery list state")
struct DiscoveryListStateTests {
    @Test("initial loading takes precedence while results are empty")
    func initialLoading() {
        let state = DiscoveryListState.resolve(
            hasPlaces: false,
            isLoading: true,
            errorMessage: nil,
            hasActiveCriteria: false
        )

        #expect(state == .loading)
        #expect(!state.offersRetry)
    }

    @Test("an empty failed load offers retry instead of claiming no matches")
    func failedInitialLoad() {
        let state = DiscoveryListState.resolve(
            hasPlaces: false,
            isLoading: false,
            errorMessage: "The Internet connection appears to be offline.",
            hasActiveCriteria: false
        )

        #expect(state == .failure(message: "The Internet connection appears to be offline."))
        #expect(state.offersRetry)
    }

    @Test("cached results stay visible with a compact stale error")
    func cachedStaleResults() {
        let state = DiscoveryListState.resolve(
            hasPlaces: true,
            isLoading: false,
            errorMessage: "The request timed out.",
            hasActiveCriteria: false
        )

        #expect(state == .results(staleError: "The request timed out."))
        #expect(state.offersRetry)
    }

    @Test("unfiltered empty results describe the current area")
    func emptyArea() {
        let state = DiscoveryListState.resolve(
            hasPlaces: false,
            isLoading: false,
            errorMessage: nil,
            hasActiveCriteria: false
        )

        #expect(
            state == .empty(
                title: "No work spots in this area",
                message: "Move the map to explore another neighborhood."
            )
        )
    }

    @Test("filtered empty results suggest changing criteria")
    func emptyCriteria() {
        let state = DiscoveryListState.resolve(
            hasPlaces: false,
            isLoading: false,
            errorMessage: nil,
            hasActiveCriteria: true
        )

        #expect(
            state == .empty(
                title: "No matching work spots",
                message: "Clear a filter or search another neighborhood."
            )
        )
    }
}
