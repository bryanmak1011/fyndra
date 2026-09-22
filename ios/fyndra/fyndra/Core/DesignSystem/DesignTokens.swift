import SwiftUI

/// T023 / FR-028. One place that decides colour, spacing, radius and type,
/// so a screen never hard-codes a number and the whole app restyles from
/// here. Deliberately small: only tokens something on screen actually uses
/// today — an unused scale is just a thing to keep in sync.
///
/// Everything resolves through semantic system colours, which gives Dark
/// Mode and the accessibility contrast settings for free (constitution III).
public enum Tokens {
    public enum Spacing {
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 16
        public static let lg: CGFloat = 24
        public static let xl: CGFloat = 32
    }

    public enum Radius {
        public static let card: CGFloat = 20
        public static let control: CGFloat = 12
        public static let pill: CGFloat = 999
    }

    public enum Size {
        /// Constitution III: nothing tappable is smaller than 44×44pt.
        public static let minimumTapTarget: CGFloat = 44
        public static let swipeActionButton: CGFloat = 60
    }

    public enum Palette {
        public static let accent = Color.accentColor
        public static let surface = Color(.secondarySystemGroupedBackground)
        public static let canvas = Color(.systemGroupedBackground)
        public static let primaryText = Color(.label)
        public static let secondaryText = Color(.secondaryLabel)
        public static let separator = Color(.separator)

        /// Right-swipe / apply.
        public static let affirmative = Color.green
        /// Left-swipe / reject.
        public static let dismissive = Color.red
        /// Something needs the user before anything else can happen.
        public static let attention = Color.orange
    }

    /// Named text roles rather than raw `.font(.system(size:))` calls, so
    /// every screen scales with Dynamic Type identically.
    public enum Typography {
        public static let cardTitle = Font.title2.weight(.semibold)
        public static let cardSubtitle = Font.headline.weight(.regular)
        public static let body = Font.body
        public static let caption = Font.caption
        public static let sectionHeader = Font.subheadline.weight(.semibold)
    }
}

extension View {
    /// The one card treatment in the app: swipe cards, tracking rows and
    /// answer-sheet fields all use it so they read as one family.
    func fyndraCard() -> some View {
        self
            .background(Tokens.Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
            .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
    }

    /// Guarantees the constitution's 44×44pt minimum without every call site
    /// remembering the number.
    func minimumTapTarget() -> some View {
        frame(minWidth: Tokens.Size.minimumTapTarget, minHeight: Tokens.Size.minimumTapTarget)
    }
}
