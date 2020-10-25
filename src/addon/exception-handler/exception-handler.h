#ifndef EXCEPTION_HANDLER_H
#define EXCEPTION_HANDLER_H

#include <napi.h>
#include <uv.h>
#include <exception>
#include <cstring>

enum class NodeError {
   Range, Reference, Generic, Type, Errno
};

class NodeException : public std::exception {
public:
   NodeError type;
   std::string message;
   std::string func;
   std::string path;
   NodeException(NodeError type, std::string message = "", std::string func = "", std::string path = "");
   const char *what() const noexcept;
};

void HandleException(Napi::Env env, std::function<void()> f);

#endif