import Foundation

/// One request against the Swipe2Work API, described declaratively so
/// `APIClient` can stay a single, generic `send` method rather than growing
/// one hand-written method per endpoint.
public struct APIRequest<Response: Decodable & Sendable>: Sendable {
    public let path: String
    public let method: String
    public let body: Data?
    public let requiresAuth: Bool

    public init(path: String, method: String = "GET", body: Data? = nil, requiresAuth: Bool = true) {
        self.path = path
        self.method = method
        self.body = body
        self.requiresAuth = requiresAuth
    }
}

/// URLSession-based client, hand-authored against contracts/openapi.yaml
/// rather than generated — see research.md "iOS networking client
/// generation" for why. Constitution IV requirements it satisfies directly:
/// explicit 30s/60s timeouts, exponential backoff on transient failures,
/// and no retry on a 4xx (those are real application errors, not
/// transport problems). Cancellation on view exit is the caller's
/// responsibility via structured concurrency (a `.task { }` modifier
/// cancels its child Task automatically when the view disappears).
public actor APIClient {
    public var bearerToken: String?

    private let baseURL: URL
    private let session: URLSession
    private let maxRetries: Int
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(
        baseURL: URL = BaseURLProvider.current,
        token: String? = nil,
        session: URLSession? = nil,
        maxRetries: Int = 3
    ) {
        self.baseURL = baseURL
        self.bearerToken = token
        self.maxRetries = maxRetries

        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.timeoutIntervalForRequest = 30
            config.timeoutIntervalForResource = 60
            self.session = URLSession(configuration: config)
        }

        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    public func send<Response>(_ request: APIRequest<Response>) async throws -> Response {
        var urlRequest = URLRequest(url: baseURL.appendingPathComponent(request.path))
        urlRequest.httpMethod = request.method
        urlRequest.httpBody = request.body
        if request.body != nil {
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if request.requiresAuth, let bearerToken {
            urlRequest.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        }

        let (data, response) = try await sendWithRetry(urlRequest, attempt: 1)

        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }

        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIClientError.unauthorized }
            let body = (try? decoder.decode(APIErrorBody.self, from: data))
                ?? APIErrorBody(code: "unknown_error", message: "HTTP \(http.statusCode)")
            throw APIClientError.server(status: http.statusCode, body: body)
        }

        // A 204 (or any success body a Decodable can't be built from, e.g.
        // empty Data) short-circuits here rather than failing JSONDecoder,
        // which rejects zero-length input outright.
        if let empty = EmptyResponse() as? Response {
            return empty
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIClientError.decodingFailed(String(describing: error))
        }
    }

    private func sendWithRetry(_ request: URLRequest, attempt: Int) async throws -> (Data, URLResponse) {
        do {
            let (data, response) = try await session.data(for: request)
            // Only 5xx is treated as transient; 4xx means "don't retry, the
            // caller made a request the server has already fully answered."
            if let http = response as? HTTPURLResponse, http.statusCode >= 500, attempt < maxRetries {
                try await backoff(attempt: attempt)
                return try await sendWithRetry(request, attempt: attempt + 1)
            }
            return (data, response)
        } catch {
            guard attempt < maxRetries, isTransportError(error) else { throw error }
            try await backoff(attempt: attempt)
            return try await sendWithRetry(request, attempt: attempt + 1)
        }
    }

    private func backoff(attempt: Int) async throws {
        let seconds = pow(2.0, Double(attempt - 1))
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    private func isTransportError(_ error: Error) -> Bool {
        (error as? URLError)?.code != .cancelled
    }
}

/// Return type for requests whose success response has no body (e.g. a
/// bare `204`).
public struct EmptyResponse: Decodable, Sendable {}
