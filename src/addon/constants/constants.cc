#include "constants.h"
#include <nan.h>

namespace Constants {
   void Prepare(Local<Object> exports) {
      auto constants = Nan::New<Object>();
      NODE_DEFINE_CONSTANT(constants, SEEK_SET);
      NODE_DEFINE_CONSTANT(constants, SEEK_CUR);
      NODE_DEFINE_CONSTANT(constants, SEEK_END);
      Nan::Set(exports, Nan::New("constants").ToLocalChecked(), constants);
   }
}
