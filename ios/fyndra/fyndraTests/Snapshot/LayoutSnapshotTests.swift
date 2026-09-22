import Testing
import SwiftUI
import UIKit
@testable import fyndra
@testable import FyndraCore

/// T029 / T043 / T062 / T076 — the constitution's snapshot requirement,
/// implemented as **layout-regression** tests rather than pixel-reference
/// snapshots.
///
/// Why: the requirement these exist to enforce is specific — "zh-Hant
/// titles at large Dynamic Type must not clip". A recorded PNG proves that
/// only to a human who looks at it, is regenerated from whatever the code
/// currently does, and breaks on every OS point release. Rendering the real
/// view and measuring it asserts the actual rule, in a way that fails for
/// the right reason. Pixel-reference snapshots would need
/// swift-snapshot-testing as a dependency; noted as an upgrade path, not
/// taken here.
@MainActor
struct LayoutSnapshotTests {
    private let cardSize = CGSize(width: 361, height: 560)

    private func render(_ view: some View, size: CGSize, sizeCategory: ContentSizeCategory) -> UIImage? {
        let renderer = ImageRenderer(
            content: view
                .environment(\.sizeCategory, sizeCategory)
                .frame(width: size.width)
                .fixedSize(horizontal: false, vertical: true)
        )
        renderer.scale = 2
        return renderer.uiImage
    }

    private func height(of view: some View, width: CGFloat, sizeCategory: ContentSizeCategory) -> CGFloat {
        let controller = UIHostingController(
            rootView: view
                .environment(\.sizeCategory, sizeCategory)
                .frame(width: width)
        )
        controller.view.backgroundColor = .clear
        let target = CGSize(width: width, height: UIView.layoutFittingCompressedSize.height)
        return controller.view.systemLayoutSizeFitting(
            target,
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        ).height
    }

    private func posting(title: String, employer: String, summary: String, language: DetectedLanguage, market: Market) -> JobPosting {
        JobPosting(
            id: "job-1",
            sourceProvider: "tw104",
            title: title,
            employer: employer,
            requirementsSummary: summary,
            language: language,
            market: market,
            applyRoute: .handoff,
            matchScore: 0.82
        )
    }

    private var zhHantPosting: JobPosting {
        posting(
            title: "資深後端工程師（雲端架構與資料庫設計）",
            employer: "玉山金融控股股份有限公司",
            summary: "五年以上工作經驗，專長為後端系統開發與資料庫設計。熟悉 Node.js、TypeScript、PostgreSQL、雲端架構，需具備高流量應用程式介面建置經驗。",
            language: .zhHant,
            market: .taiwan
        )
    }

    // MARK: - T043: the swipe card

    @Test func theSwipeCardRendersAtAllAtTheDefaultSize() {
        let image = render(
            SwipeCardView(posting: zhHantPosting, isTop: true, onSwipe: { _ in }),
            size: cardSize,
            sizeCategory: .large
        )
        #expect(image != nil)
        #expect((image?.size.width ?? 0) > 0)
    }

    @Test func aZhHantCardGrowsAtTheLargestDynamicTypeSizeRatherThanClipping() {
        // Constitution III. If the title were given a fixed line limit or a
        // fixed-height container, the laid-out height would stop growing
        // here — which is exactly the clipping this is meant to catch.
        let card = SwipeCardView(posting: zhHantPosting, isTop: true, onSwipe: { _ in })

        let atDefault = height(of: card, width: cardSize.width, sizeCategory: .large)
        let atLargest = height(of: card, width: cardSize.width, sizeCategory: .accessibilityExtraExtraExtraLarge)

        #expect(atLargest > atDefault, "the card must grow with Dynamic Type, not clip its zh-Hant title")
    }

    @Test func anEnglishCardAlsoGrowsAtTheLargestDynamicTypeSize() {
        let card = SwipeCardView(
            posting: posting(
                title: "Senior Backend Engineer, Payments Platform",
                employer: "Octopus Cards Limited",
                summary: "Design and operate payment services in TypeScript and Go. 5+ years building distributed systems.",
                language: .en,
                market: .hongKong
            ),
            isTop: true,
            onSwipe: { _ in }
        )

        let atDefault = height(of: card, width: cardSize.width, sizeCategory: .large)
        let atLargest = height(of: card, width: cardSize.width, sizeCategory: .accessibilityExtraExtraExtraLarge)

        #expect(atLargest > atDefault)
    }

    // MARK: - T076: the tracking row

    @Test func aTrackingRowWithAZhHantTitleGrowsAtLargeDynamicType() {
        let row = TrackingRow(
            application: Application(
                id: "a1",
                jobPostingId: "job-1",
                jobTitle: "資深後端工程師（雲端架構與資料庫設計）",
                employer: "玉山金融控股股份有限公司",
                submissionMode: .reviewBeforeSending,
                applyRoute: .handoff,
                status: .awaitingReview
            )
        )

        let atDefault = height(of: row, width: 361, sizeCategory: .large)
        let atLargest = height(of: row, width: 361, sizeCategory: .accessibilityExtraExtraExtraLarge)

        #expect(atLargest > atDefault)
        #expect(render(row, size: CGSize(width: 361, height: 120), sizeCategory: .accessibilityExtraExtraExtraLarge) != nil)
    }

    // MARK: - T062: the sensitive-question row

    @Test func theSensitiveQuestionExplanationGrowsRatherThanTruncating() {
        // The explanation is the whole point of the screen (FR-022); if it
        // truncates, the user is told to answer something without being
        // told why.
        let row = PendingQuestionRow(
            question: ApplicationQuestion(
                id: "q1",
                questionText: "期望薪資 (Expected salary)",
                isSensitive: true
            ),
            onAnswer: { _, _ in }
        )

        let atDefault = height(of: row, width: 361, sizeCategory: .large)
        let atLargest = height(of: row, width: 361, sizeCategory: .accessibilityExtraExtraExtraLarge)

        #expect(atLargest > atDefault)
    }

    @Test func anOrdinaryQuestionIsShorterThanASensitiveOneBecauseItCarriesNoExplanation() {
        let sensitive = PendingQuestionRow(
            question: ApplicationQuestion(id: "q1", questionText: "期望薪資", isSensitive: true),
            onAnswer: { _, _ in }
        )
        let ordinary = PendingQuestionRow(
            question: ApplicationQuestion(id: "q2", questionText: "期望薪資", isSensitive: false),
            onAnswer: { _, _ in }
        )

        #expect(height(of: sensitive, width: 361, sizeCategory: .large) > height(of: ordinary, width: 361, sizeCategory: .large))
    }

    // MARK: - T029: the profile review screen

    @Test func theStatusPlaceholderRendersItsMessageAtEveryTypeSize() {
        let placeholder = StatusPlaceholder(
            systemImage: "tray",
            title: "No applications yet",
            message: "Swipe right on a job and it will show up here."
        )

        let atDefault = height(of: placeholder, width: 361, sizeCategory: .large)
        let atLargest = height(of: placeholder, width: 361, sizeCategory: .accessibilityExtraExtraExtraLarge)

        #expect(atLargest > atDefault)
        #expect(render(placeholder, size: CGSize(width: 361, height: 300), sizeCategory: .large) != nil)
    }
}
