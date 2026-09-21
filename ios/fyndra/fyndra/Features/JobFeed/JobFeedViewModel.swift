import Foundation
import Observation
import FyndraCore

/// The swipe deck's state.
///
/// The load-ahead rule is the point of this class: a swipe must never wait
/// on the network (T055). So the deck keeps a local queue of already-fetched
/// cards, removes the top card the instant the gesture completes, and sends
/// the swipe as a detached task. The next page is requested while several
/// cards are still in hand, not when the deck runs dry.
@MainActor
@Observable
final class JobFeedViewModel {
    private(set) var state: LoadState<[JobPosting]> = .loading
    /// True only when the server said there is nothing left, not merely
    /// when the local deck is empty (FR-004a).
    private(set) var exhausted = false
    /// Set when a swipe is refused — a spent cap (409) is the common case,
    /// and silently dropping it would look like the app ignored the swipe.
    var swipeRejection: String?

    private let session: AppSession
    private var deck: [JobPosting] = []
    private var isFetching = false

    /// Fetch more while this many cards are still in hand.
    private let prefetchThreshold = 4
    private let pageSize = 20

    init(session: AppSession) {
        self.session = session
    }

    var cards: [JobPosting] { deck }
    var topCard: JobPosting? { deck.first }

    func load() async {
        state = .loading
        exhausted = false
        deck = []
        await fetchNextPage()
    }

    /// Records the swipe and moves on immediately. The card is removed from
    /// the deck before the request is even sent — FR-014 makes re-swiping
    /// idempotent, so the worst case of an unsent swipe is that the job
    /// reappears in a later feed, not a lost or duplicated application.
    func swipe(_ posting: JobPosting, direction: SwipeDirection) {
        deck.removeAll { $0.id == posting.id }
        publishDeck()

        if deck.count <= prefetchThreshold && !exhausted {
            Task { await fetchNextPage() }
        }

        Task { [session] in
            do {
                _ = try await session.api.swipe(jobId: posting.id, direction: direction)
                if direction == .right {
                    // The cap counter on the profile just moved.
                    await session.refreshProfile()
                }
            } catch {
                await MainActor.run {
                    let message = ErrorMessage.text(for: error)
                    if !message.isEmpty { self.swipeRejection = message }
                }
            }
        }
    }

    private func fetchNextPage() async {
        guard !isFetching else { return }
        isFetching = true
        defer { isFetching = false }

        do {
            let page = try await session.api.getFeed(limit: pageSize)
            // The server filters swiped jobs, but a page fetched while a
            // swipe was still in flight can still contain a card we have
            // just removed locally.
            let known = Set(deck.map(\.id))
            deck.append(contentsOf: page.items.filter { !known.contains($0.id) })
            exhausted = page.exhausted
            publishDeck()
        } catch {
            // Keep whatever is already in hand: a failed refill should not
            // wipe out cards the user can still swipe.
            if deck.isEmpty {
                state = .failed(ErrorMessage.text(for: error))
            }
        }
    }

    private func publishDeck() {
        state = deck.isEmpty ? .empty : .loaded(deck)
    }
}
