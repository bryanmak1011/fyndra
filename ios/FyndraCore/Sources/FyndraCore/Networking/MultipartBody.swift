import Foundation

/// Builds a `multipart/form-data` body by hand. The CV upload is the only
/// multipart request in the whole contract, so a dependency (or a
/// general-purpose form encoder) would be more machinery than the one call
/// site justifies — the format is a handful of boundary lines.
public struct MultipartBody: Sendable {
    public let boundary: String
    public let data: Data

    public var contentType: String { "multipart/form-data; boundary=\(boundary)" }

    /// One `file` part, which is all `POST /profile/cv` reads.
    public init(fileField name: String, filename: String, mimeType: String, fileData: Data) {
        let boundary = "fyndra.\(UUID().uuidString)"
        self.boundary = boundary

        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n")
        body.append("Content-Type: \(mimeType)\r\n\r\n")
        body.append(fileData)
        body.append("\r\n--\(boundary)--\r\n")
        self.data = body
    }

    /// The MIME types the server accepts (`extract.ts`); anything else is a
    /// 422 `unsupported_format`, so the picker filters to these two.
    public static func mimeType(forPathExtension ext: String) -> String {
        switch ext.lowercased() {
        case "pdf": "application/pdf"
        case "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        default: "application/octet-stream"
        }
    }
}

private extension Data {
    mutating func append(_ string: String) {
        // Boundary/header lines are ASCII by construction, so this can only
        // fail if the caller put something non-UTF-8 in a filename — in
        // which case dropping the part would corrupt the body silently.
        append(Data(string.utf8))
    }
}
