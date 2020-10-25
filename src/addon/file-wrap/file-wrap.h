#ifndef FILE_WRAP_H
#define FILE_WRAP_H

#include <napi.h>
#include <uv.h>
#include <cstdio>
#include "../utils/utils.h"
namespace FileWrap {
   void Prepare(Napi::Env env, Napi::Object exports);
   class File : public Napi::ObjectWrap<File> {
   public:
      static void Init(Napi::Env env, Napi::Object exports);
   private:
      File(const Napi::CallbackInfo &info);

      int fd;
      FILE *file;
      IOState state;

      bool isClose = false;
      Napi::Value getFd(const Napi::CallbackInfo &info) {
         return Napi::Number::New(info.Env(), this->fd);
      }
      Napi::Value getCanSeek(const Napi::CallbackInfo& info) {
         return Napi::Boolean::New(info.Env(), this->state.canSeek);
      }
      Napi::Value getCanRead(const Napi::CallbackInfo& info) {
         return Napi::Boolean::New(info.Env(), this->state.canRead);
      }
      Napi::Value getCanWrite(const Napi::CallbackInfo& info) {
         return Napi::Boolean::New(info.Env(), this->state.canWrite);
      }
      Napi::Value getCanAppend(const Napi::CallbackInfo& info) {
         return Napi::Boolean::New(info.Env(), this->state.canAppend);
      }
      ~File() {
         if (this->isClose) return;
         fclose(this->file);
         this->isClose = true;
      }
      Napi::Value ThrowIfClosed(const Napi::CallbackInfo &info);
      Napi::Value close(const Napi::CallbackInfo& info);
      Napi::Value seek(const Napi::CallbackInfo& info);
      Napi::Value tell(const Napi::CallbackInfo& info);
      Napi::Value read(const Napi::CallbackInfo& info);
      Napi::Value write(const Napi::CallbackInfo& info);
      Napi::Value flush(const Napi::CallbackInfo& info);
      Napi::Value setBufSize(const Napi::CallbackInfo& info);
   };
}

#endif // !FILE_WRAP_H
