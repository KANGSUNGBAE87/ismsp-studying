import AppKit
import Foundation
import Vision

struct OCRResult: Codable {
  let file: String
  let text: String
  let error: String?
}

func recognize(path: String) -> OCRResult {
  let url = URL(fileURLWithPath: path)
  guard let image = NSImage(contentsOf: url) else {
    return OCRResult(file: path, text: "", error: "image_load_failed")
  }

  var rect = CGRect(origin: .zero, size: image.size)
  guard let cgImage = image.cgImage(forProposedRect: &rect, context: nil, hints: nil) else {
    return OCRResult(file: path, text: "", error: "cgimage_failed")
  }

  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  request.recognitionLanguages = ["ko-KR", "en-US"]

  do {
    try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
  } catch {
    return OCRResult(file: path, text: "", error: "vision_failed: \(error.localizedDescription)")
  }

  let observations = request.results ?? []
  let lines = observations.compactMap { observation in
    observation.topCandidates(1).first?.string
  }
  return OCRResult(file: path, text: lines.joined(separator: "\n"), error: nil)
}

let results = CommandLine.arguments.dropFirst().map { recognize(path: String($0)) }
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .withoutEscapingSlashes]
let data = try encoder.encode(results)
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
