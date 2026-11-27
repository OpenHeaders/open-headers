{
  "targets": [
    {
      "target_name": "windows_package_update",
      "sources": [
        "src/win32.cc"
      ],
      'conditions': [
        ['OS=="win"', {
          'libraries': [
            'runtimeobject.lib'
          ]
        }]
      ],
      'msvs_configuration_attributes': {
        'SpectreMitigation': 'Spectre'
      },
      'msvs_settings': {
        'VCCLCompilerTool': {
          'AdditionalOptions': [
            '/guard:cf',
            '/we4244',
            '/we4267',
            '/ZH:SHA_256'
          ]
        },
        'VCLinkerTool': {
          'AdditionalOptions': [
            '/guard:cf'
          ]
        }
      }
    }
  ]
}
