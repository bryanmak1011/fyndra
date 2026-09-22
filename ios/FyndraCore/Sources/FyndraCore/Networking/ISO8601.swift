import Foundation

/// Date parsing for API responses.
///
/// `JSONDecoder.dateDecodingStrategy = .iso8601` is `ISO8601DateFormatter`
/// with `.withInternetDateTime` and nothing else, which rejects fractional
/// seconds — and fractional seconds are exactly what the API sends. Every
/// timestamp on the wire comes from Prisma via `JSON.stringify(Date)`, i.e.
/// `"2026-09-21T01:00:00.000Z"`, always with milliseconds.
///
/// That mismatch was invisible during development: macOS 26 / iOS 26 ship a
/// rewritten Foundation whose `.iso8601` quietly accepts the fractional form,
/// so the suite passed on a 26.x machine and failed the moment CI ran it on
/// macOS 15. The app deploys to iOS 17, so the strict parse is what most
/// supported devices would have used — `GET /applications/{id}` and the
/// `expiresAt` in every sign-in response would have failed to decode in
/// production while looking perfect locally.
///
/// So: accept both shapes explicitly, and never depend on which Foundation
/// the OS happens to provide.
enum ISO8601 {
    /// Parses `.withInternetDateTime`, with or without fractional seconds.
    static func date(from string: String) -> Date? {
        // A formatter per call rather than a cached one: `ISO8601DateFormatter`
        // is not `Sendable`, so a shared instance needs `nonisolated(unsafe)`,
        // and a response carries a handful of dates at most (a session expiry,
        // a submission time, a status-history row) — not a hot path worth an
        // unchecked concurrency escape hatch.
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = string.contains(".")
            ? [.withInternetDateTime, .withFractionalSeconds]
            : [.withInternetDateTime]
        return formatter.date(from: string)
    }

    static func string(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    static let decoding = JSONDecoder.DateDecodingStrategy.custom { decoder in
        let string = try decoder.singleValueContainer().decode(String.self)
        guard let date = ISO8601.date(from: string) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: decoder.codingPath,
                    debugDescription: "Expected an ISO8601 date, got \"\(string)\""
                )
            )
        }
        return date
    }

    static let encoding = JSONEncoder.DateEncodingStrategy.custom { date, encoder in
        var container = encoder.singleValueContainer()
        try container.encode(ISO8601.string(from: date))
    }
}
