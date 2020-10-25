#include "constants.h"
#include <napi.h>
#include <uv.h>

namespace Constants {
   void Prepare(Napi::Env env, Napi::Object exports) {
      auto constants = Napi::Object::New(env);
      constants.Set("SEEK_SET", SEEK_SET);
      constants.Set("SEEK_CUR", SEEK_CUR);
      constants.Set("SEEK_END", SEEK_END);
      exports.Set("constants", constants);
   }
}
