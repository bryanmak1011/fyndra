import Foundation

/// Mirrors the `Error` schema in contracts/openapi.yaml — every failed
/// request the API returns decodes into this.
public struct APIErrorBody: Codable, Sendable, Equatable {
    public let code: String
    public let message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
    }
}

/// Errors the client itself can raise, distinct from a well-formed
/// `APIErrorBody` the server sent back.
public enum APIClientError: Error, Sendable, Equatable {
    case invalidResponse
    case decodingFailed(String)
    case server(status: Int, body: APIErrorBody)
    case unauthorized
}
