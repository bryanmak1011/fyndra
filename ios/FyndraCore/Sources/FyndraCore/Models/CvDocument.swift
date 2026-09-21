import Foundation

/// Mirrors `CvDocument` in contracts/openapi.yaml. Format rejections never
/// produce one of these — they come back as a 422 with an `Error` body — so
/// `parsing`/`succeeded`/`failed` really are the only reachable states.
public struct CvDocument: Codable, Sendable, Equatable, Identifiable {
    public enum FileFormat: String, Codable, Sendable {
        case pdf
        case docx
    }

    public enum ParseStatus: String, Codable, Sendable {
        case parsing
        case succeeded
        case failed
    }

    public let id: String
    public let fileFormat: FileFormat
    public let parseStatus: ParseStatus
    public let detectedLanguage: DetectedLanguage?
    public let rawExtractedKeywords: [String]
    public let rawExtractedYoe: Int?

    public init(
        id: String,
        fileFormat: FileFormat,
        parseStatus: ParseStatus,
        detectedLanguage: DetectedLanguage? = nil,
        rawExtractedKeywords: [String] = [],
        rawExtractedYoe: Int? = nil
    ) {
        self.id = id
        self.fileFormat = fileFormat
        self.parseStatus = parseStatus
        self.detectedLanguage = detectedLanguage
        self.rawExtractedKeywords = rawExtractedKeywords
        self.rawExtractedYoe = rawExtractedYoe
    }
}

/// The language the server detected in a CV or posting. Distinct from
/// `AppLanguage` (the user's UI preference), which has no `mixed` case —
/// the UI renders in one language, a document can genuinely be both.
public enum DetectedLanguage: String, Codable, Sendable {
    case zhHant = "zh-Hant"
    case en
    case mixed
}

/// The 422 codes `POST /profile/cv` returns, named so the UI can explain
/// each one specifically rather than showing a generic upload failure.
public enum CvUploadRejection: String, Sendable {
    case unsupportedFormat = "unsupported_format"
    case noTextLayer = "no_text_layer"
    case passwordProtected = "password_protected"

    public init?(errorCode: String) {
        self.init(rawValue: errorCode)
    }
}
