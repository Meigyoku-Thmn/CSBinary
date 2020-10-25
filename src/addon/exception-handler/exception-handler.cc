#include "exception-handler.h"
extern "C" {
#include "../errnoname/errnoname.h"
}

NodeException::NodeException(NodeError type, std::string message, std::string func, std::string path)
   : std::exception(), type(type), message(message), func(func), path(path) {}

const char *NodeException::what() const noexcept {
   return message.c_str();
}

void HandleException(Napi::Env env, std::function<void()> f) {
   try {
      f();
   } catch (NodeException &e) {
      switch (e.type) {
         case NodeError::Generic:
            return Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Range:
            return Napi::RangeError::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Reference:
            // waiting for a day that Napi would have ReferenceError
            return Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Type:
            return Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
         case NodeError::Errno: {
            auto func = e.func.length() == 0 ? NULL : e.func.c_str();
            auto message = e.message.length() == 0 ? NULL : e.message.c_str();
            auto path = e.path.length() == 0 ? NULL : e.path.c_str();
            auto code = errnoname(errno);
            auto msg = code + std::string(": ") + strerror(errno) + " (" + message + ")";
            auto err = Napi::Error::New(env, msg);
            err.Set("code", code);
            err.Set("errno", (double)errno);
            err.Set("syscall", func);
            err.Set("path", path);
            return err.ThrowAsJavaScriptException();
         }
         default:
            throw;
      }
   } catch (std::exception &e) {
      return Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
   }
}