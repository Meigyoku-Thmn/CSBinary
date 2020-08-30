{
  "targets": [
    {
      "target_name": "addon",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      'xcode_settings': {
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
      },
      "sources": [ 
        "src/addon/entry.cc" ,

        "src/addon/file-wrap/file-wrap.h",
        "src/addon/file-wrap/file-wrap.cc",
        
        "src/addon/utils/utils.h",
        "src/addon/utils/utils.cc",

        "src/addon/exception-handler/exception-handler.h",

        "src/addon/constants/constants.h",
        "src/addon/constants/constants.cc",
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
      'defines': [
        '_CRT_SECURE_NO_WARNINGS',
        'WIN32_LEAN_AND_MEAN',
      ],
    }
  ]
}