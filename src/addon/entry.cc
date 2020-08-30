#include <nan.h>
#include "utils/utils.h"
#include "file-wrap/file-wrap.h"
#include "constants/constants.h"
#ifdef _WIN32
static void invalid_parameter_function(LPCWSTR a, LPCWSTR b, LPCWSTR c, UINT d, uintptr_t e) {
   // Please, just return an error signal value
}
#endif

NAN_MODULE_INIT(Init) {
#ifdef _WIN32
   _set_invalid_parameter_handler(invalid_parameter_function);
   ImportNtDllFunctions();
#endif
   FileWrap::Prepare(target);
   Constants::Prepare(target);
}

NODE_MODULE(addon, Init)