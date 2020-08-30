#ifndef FILE_WRAP_H
#define FILE_WRAP_H

#include <nan.h>
#include <cstdio>
#include "../utils/utils.h"
namespace FileWrap {
   using namespace v8;
   void Prepare(Local<Object> exports);
   class File : public node::ObjectWrap {
   public:
      static void Init(Local<Object> exports);
   private:
      File(int fd, FILE *file, IOState state) : fd(fd), file(file), state(state) {}
      static Nan::Persistent<Function> constructor;
      static NAN_METHOD(New);

      int fd;
      FILE *file;
      IOState state;
      bool isClose = false;
      static NAN_GETTER(getFd) {
         auto obj = Unwrap<File>(info.This());
         info.GetReturnValue().Set(Nan::New(obj->fd));
      }
      static NAN_GETTER(getCanSeek) {
         auto obj = Unwrap<File>(info.This());
         info.GetReturnValue().Set(Nan::New(obj->state.canSeek));
      }
      static NAN_GETTER(getCanRead) {
         auto obj = Unwrap<File>(info.This());
         info.GetReturnValue().Set(Nan::New(obj->state.canRead));
      }
      static NAN_GETTER(getCanWrite) {
         auto obj = Unwrap<File>(info.This());
         info.GetReturnValue().Set(Nan::New(obj->state.canWrite));
      }
      static NAN_GETTER(getCanAppend) {
         auto obj = Unwrap<File>(info.This());
         info.GetReturnValue().Set(Nan::New(obj->state.canAppend));
      }
      static NAN_METHOD(ThrowIfClosed);
      ~File() {
         fclose(this->file);
         this->isClose = true;
      }

      static NAN_METHOD(close);
      static NAN_METHOD(seek);
      static NAN_METHOD(tell);
      static NAN_METHOD(read);
      static NAN_METHOD(write);
      static NAN_METHOD(flush);
      static NAN_METHOD(setBufSize);
   };
}

#endif // !FILE_WRAP_H
