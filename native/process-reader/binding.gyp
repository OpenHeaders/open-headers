{
  "targets": [
    {
      "target_name": "process_reader",
      "sources": [
        "src/darwin.cc"
      ],
      "xcode_settings": {
        "MACOSX_DEPLOYMENT_TARGET": "11.0",
        "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
        "WARNING_CFLAGS": [
          "-Wall",
          "-Wextra"
        ]
      }
    }
  ]
}
