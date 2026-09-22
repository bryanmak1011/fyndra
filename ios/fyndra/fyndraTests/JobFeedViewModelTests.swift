import Testing
import Foundation
@testable import fyndra
@testable import FyndraCore

/// The deck's rules, tested against a scripted API rather than a server.
/// The behaviour that matters here is timing — a swipe must not wait on the
/// network, and a page must be requested before the deck runs out — which
/// is exactly what a live-server test cannot pin down.
@MainActor
struct JobFeedViewModelTests {
    @Test func loadsAPageAndSurfacesTheTopCard() async {
        let api = ScriptedAPI(feedPages: [page(ids: ["a", "b", "c"], exhausted: true)])
        let model = JobFeedViewModel(session: AppSession(api: api))

        await model.load()

        #expect(model.cards.count == 3)
        #expect(model.topCard?.id == "a")
        #expect(model.exhausted)
    }

    @Test func aSwipeRemovesTheCardImmediatelyWithoutAwaitingTheServer() async throws {
        // The API never returns: if the deck waited on it, the card would
        // still be showing after the swipe.
        let api = ScriptedAPI(feedPages: [page(ids: ["a", "b"], exhausted: true)], hangsOnSwipe: true)
        let model = JobFeedViewModel(session: AppSession(api: api))
        await model.load()

        model.swipe(try #require(model.topCard), direction: .left)

        #expect(model.topCard?.id == "b")
        #expect(model.cards.count == 1)
    }

    @Test func showsTheEndOfFeedStateOnlyWhenTheDeckIsActuallyEmpty() async throws {
        let api = ScriptedAPI(feedPages: [page(ids: ["a"], exhausted: true)])
        let model = JobFeedViewModel(session: AppSession(api: api))
        await model.load()

        model.swipe(try #require(model.topCard), direction: .left)

        if case .empty = model.state {} else {
            Issue.record("expected the empty state once the last card is gone, got \(model.state)")
        }
        #expect(model.exhausted)
    }

    @Test func refillsBeforeTheDeckRunsDry() async throws {
        // Five cards, then a second page. The threshold is four, so the
        // refill must fire on the second swipe (five down to four), not
        // when the deck empties.
        let api = ScriptedAPI(feedPages: [
            page(ids: ["a", "b", "c", "d", "e"], exhausted: false),
            page(ids: ["f", "g"], exhausted: true)
        ])
        let model = JobFeedViewModel(session: AppSession(api: api))
        await model.load()
        #expect(await api.feedCallCount == 1)

        model.swipe(try #require(model.topCard), direction: .left)
        await settle()

        #expect(await api.feedCallCount == 2)
        #expect(model.cards.map(\.id) == ["b", "c", "d", "e", "f", "g"])
    }

    @Test func aRefilledPageNeverReintroducesACardTheUserJustSwiped() async throws {
        // The server filters swiped jobs, but a page already in flight when
        // the swipe happened can still contain it.
        let api = ScriptedAPI(feedPages: [
            page(ids: ["a", "b"], exhausted: false),
            page(ids: ["b", "c"], exhausted: true)
        ])
        let model = JobFeedViewModel(session: AppSession(api: api))
        await model.load()

        model.swipe(try #require(model.topCard), direction: .left)
        await settle()

        #expect(model.cards.map(\.id) == ["b", "c"])
    }

    @Test func aRejectedSwipeIsSurfacedRatherThanSwallowed() async throws {
        // A spent daily cap comes back as a 409; dropping it silently would
        // look like the app ignored the swipe.
        let api = ScriptedAPI(
            feedPages: [page(ids: ["a", "b"], exhausted: true)],
            swipeError: APIClientError.server(
                status: 409,
                body: APIErrorBody(code: "cap_reached", message: "Daily or per-employer submission cap reached")
            )
        )
        let model = JobFeedViewModel(session: AppSession(api: api))
        await model.load()

        model.swipe(try #require(model.topCard), direction: .right)
        await settle()

        #expect(model.swipeRejection == "Daily or per-employer submission cap reached")
    }

    @Test func aFailedRefillKeepsTheCardsAlreadyInHand() async throws {
        let api = ScriptedAPI(feedPages: [page(ids: ["a", "b", "c"], exhausted: false)], failSubsequentFeeds: true)
        let model = JobFeedViewModel(session: AppSession(api: api))
        await model.load()

        model.swipe(try #require(model.topCard), direction: .left)
        await settle()

        #expect(model.cards.map(\.id) == ["b", "c"])
        if case .failed = model.state {
            Issue.record("a failed refill must not wipe out cards the user can still swipe")
        }
    }

    // MARK: - helpers

    private func page(ids: [String], exhausted: Bool) -> JobFeedPage {
        JobFeedPage(
            items: ids.map {
                JobPosting(
                    id: $0,
                    sourceProvider: "test",
                    title: "Role \($0)",
                    employer: "Employer \($0)",
                    requirementsSummary: "",
                    language: .en,
                    market: .hongKong,
                    applyRoute: .handoff,
                    matchScore: 0.5
                )
            },
            exhausted: exhausted
        )
    }

    /// The deck fires its refill and its swipe as detached tasks, so a test
    /// has to let the runtime drain them before asserting.
    private func settle() async {
        for _ in 0..<20 { await Task.yield() }
        try? await Task.sleep(for: .milliseconds(50))
        for _ in 0..<20 { await Task.yield() }
    }
}
